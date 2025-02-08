from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from src.models import Subject, GoogleDriveCredentials, get_db
from src.google_drive.drive_service import GoogleDriveService
from src.google_drive.auth import GoogleDriveAuth
from src.decorators import professor_required
import pandas as pd
from io import StringIO
import csv
from datetime import datetime

faq_bp = Blueprint('faq', __name__, url_prefix='/professor/faq')

@faq_bp.route('/subject/<int:subject_id>/questions', methods=['GET'])
@login_required
@professor_required
def get_subject_faqs(subject_id):
    """Get all FAQs for a subject, including pending questions"""
    db = next(get_db())
    try:
        # Verify subject ownership
        subject = db.query(Subject).filter_by(
            id=subject_id,
            professor_id=current_user.id
        ).first()

        if not subject or not subject.faq_file_id:
            return jsonify({"error": "Subject or FAQ file not found"}), 404

        # Get Drive credentials and service
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()

        if not drive_creds:
            return jsonify({"error": "Drive not connected"}), 403

        google_auth = GoogleDriveAuth()
        credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
        drive_service = GoogleDriveService(credentials)

        try:
            # Download and read FAQ file
            faq_content = drive_service.download_file(subject.faq_file_id)
            
            # If the file is empty or new, initialize with headers
            if not faq_content.strip():
                faq_content = "number,question,answer,date_asked,date_answered\n"
            
            # Read CSV content
            df = pd.read_csv(StringIO(faq_content))
            
            # Replace NaN values with None
            df = df.replace({pd.NA: None, pd.NaT: None, float('nan'): None})
            
            # Convert DataFrame to records and handle None values
            def clean_record(record):
                return {
                    key: (None if pd.isna(value) else value)
                    for key, value in record.items()
                }
            
            # Process pending and answered questions
            pending_mask = df['answer'].isna()
            pending_questions = [
                clean_record(record) 
                for record in df[pending_mask].to_dict('records')
            ]
            answered_questions = [
                clean_record(record) 
                for record in df[~pending_mask].to_dict('records')
            ]

            return jsonify({
                "pending_questions": pending_questions,
                "answered_questions": answered_questions
            })
            
        except Exception as e:
            print(f"Error processing FAQ file: {str(e)}")
            # Initialize empty FAQ file if there's an error
            empty_data = {
                "pending_questions": [],
                "answered_questions": []
            }
            return jsonify(empty_data)

    except Exception as e:
        print(f"Error getting FAQs: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

@faq_bp.route('/subject/<int:subject_id>/questions/<int:question_number>', methods=['PUT'])
@login_required
@professor_required
def update_faq(subject_id, question_number):
    """Update a FAQ answer or question"""
    data = request.get_json()
    if not data or ('answer' not in data and 'question' not in data):
        return jsonify({"error": "Answer or question required"}), 400

    db = next(get_db())
    try:
        # Verify subject ownership
        subject = db.query(Subject).filter_by(
            id=subject_id,
            professor_id=current_user.id
        ).first()

        if not subject or not subject.faq_file_id:
            return jsonify({"error": "Subject or FAQ file not found"}), 404

        # Get Drive credentials and service
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()

        if not drive_creds:
            return jsonify({"error": "Drive not connected"}), 403

        google_auth = GoogleDriveAuth()
        credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
        drive_service = GoogleDriveService(credentials)

        # Download current FAQ file
        faq_content = drive_service.download_file(subject.faq_file_id)
        df = pd.read_csv(StringIO(faq_content))

        # Find and update the specific question
        mask = df['number'] == question_number
        if not any(mask):
            return jsonify({"error": "Question not found"}), 404

        # Update the row
        if 'question' in data:
            df.loc[mask, 'question'] = data['question']
        if 'answer' in data:
            df.loc[mask, 'answer'] = data['answer']
            df.loc[mask, 'date_answered'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # Save back to CSV
        csv_buffer = StringIO()
        df.to_csv(csv_buffer, index=False)
        drive_service.update_file(subject.faq_file_id, csv_buffer.getvalue())

        return jsonify({
            "message": "FAQ updated successfully",
            "question": df[mask].to_dict('records')[0]
        })

    except Exception as e:
        print(f"Error updating FAQ: {str(e)}")
        return jsonify({"error": "Failed to update FAQ"}), 500
    finally:
        db.close()

@faq_bp.route('/subject/<int:subject_id>/questions/<int:question_number>', methods=['DELETE'])
@login_required
@professor_required
def delete_faq(subject_id, question_number):
    """Delete a FAQ question"""
    db = next(get_db())
    try:
        # Verify subject ownership
        subject = db.query(Subject).filter_by(
            id=subject_id,
            professor_id=current_user.id
        ).first()

        if not subject or not subject.faq_file_id:
            return jsonify({"error": "Subject or FAQ file not found"}), 404

        # Get Drive credentials and service
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()

        if not drive_creds:
            return jsonify({"error": "Drive not connected"}), 403

        google_auth = GoogleDriveAuth()
        credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
        drive_service = GoogleDriveService(credentials)

        # Download current FAQ file
        faq_content = drive_service.download_file(subject.faq_file_id)
        df = pd.read_csv(StringIO(faq_content))

        # Find and delete the specific question
        mask = df['number'] == question_number
        if not any(mask):
            return jsonify({"error": "Question not found"}), 404

        # Remove the row and reindex remaining questions
        df = df[~mask].copy()
        df['number'] = range(1, len(df) + 1)

        # Save back to CSV
        csv_buffer = StringIO()
        df.to_csv(csv_buffer, index=False)
        drive_service.update_file(subject.faq_file_id, csv_buffer.getvalue())

        return jsonify({
            "message": "FAQ deleted successfully"
        })

    except Exception as e:
        print(f"Error deleting FAQ: {str(e)}")
        return jsonify({"error": "Failed to delete FAQ"}), 500
    finally:
        db.close()

@faq_bp.route('/subject/<int:subject_id>/questions/pending', methods=['GET'])
@login_required
@professor_required
def get_pending_questions(subject_id):
    """Get only pending questions for a subject"""
    db = next(get_db())
    try:
        # Verify subject ownership
        subject = db.query(Subject).filter_by(
            id=subject_id,
            professor_id=current_user.id
        ).first()

        if not subject or not subject.faq_file_id:
            return jsonify({"error": "Subject or FAQ file not found"}), 404

        # Get Drive credentials and service
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()

        if not drive_creds:
            return jsonify({"error": "Drive not connected"}), 403

        google_auth = GoogleDriveAuth()
        credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
        drive_service = GoogleDriveService(credentials)

        # Download and read FAQ file
        faq_content = drive_service.download_file(subject.faq_file_id)
        df = pd.read_csv(StringIO(faq_content))

        # Get only pending questions
        pending_questions = df[df['answer'].isna()].to_dict('records')

        return jsonify({
            "pending_questions": pending_questions,
            "count": len(pending_questions)
        })

    except Exception as e:
        print(f"Error getting pending questions: {str(e)}")
        return jsonify({"error": "Failed to get pending questions"}), 500
    finally:
        db.close()

@faq_bp.route('/subject/<int:subject_id>/questions/answer', methods=['POST'])
@login_required
@professor_required
def answer_question(subject_id):
    """Answer a pending question"""
    data = request.get_json()
    if not data or 'question_number' not in data or 'answer' not in data:
        return jsonify({"error": "Question number and answer required"}), 400

    db = next(get_db())
    try:
        # Verify subject ownership
        subject = db.query(Subject).filter_by(
            id=subject_id,
            professor_id=current_user.id
        ).first()

        if not subject or not subject.faq_file_id:
            return jsonify({"error": "Subject or FAQ file not found"}), 404

        # Get Drive credentials and service
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()

        if not drive_creds:
            return jsonify({"error": "Drive not connected"}), 403

        google_auth = GoogleDriveAuth()
        credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
        drive_service = GoogleDriveService(credentials)

        # Download current FAQ file
        faq_content = drive_service.download_file(subject.faq_file_id)
        df = pd.read_csv(StringIO(faq_content))

        # Find and update the specific question
        question_number = int(data['question_number'])
        mask = df['number'] == question_number
        if not any(mask):
            return jsonify({"error": "Question not found"}), 404

        # Update the answer and timestamp
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        df.loc[mask, 'answer'] = data['answer']
        df.loc[mask, 'date_answered'] = current_time

        # Save back to CSV
        csv_buffer = StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_content = csv_buffer.getvalue()
        
        # Update the file in Drive
        drive_service.update_file(subject.faq_file_id, csv_content)

        # Return the updated question data
        updated_question = df[mask].to_dict('records')[0]
        # Clean any NaN values
        updated_question = {
            k: (None if pd.isna(v) else v) 
            for k, v in updated_question.items()
        }

        return jsonify({
            "message": "Question answered successfully",
            "question": updated_question
        })

    except Exception as e:
        print(f"Error answering question: {str(e)}")
        return jsonify({"error": f"Failed to submit answer: {str(e)}"}), 500
    finally:
        db.close()