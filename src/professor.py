from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from src.models import User, Subject, SubjectFile, get_db
from werkzeug.utils import secure_filename
import os
from functools import wraps

professor_bp = Blueprint('professor', __name__, url_prefix='/professor')

# Custom decorator to check if user is a professor
def professor_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != 'professor':
            return jsonify({"error": "Professor access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

@professor_bp.route('/subjects', methods=['POST'])
@login_required
@professor_required
def create_subject():
    """Create a new subject"""
    data = request.get_json()
    
    if not data or 'name' not in data:
        return jsonify({"error": "Subject name is required"}), 400
    
    db = next(get_db())
    try:
        new_subject = Subject(
            name=data['name'],
            professor_id=current_user.id
        )
        db.add(new_subject)
        db.commit()
        
        return jsonify({
            "message": "Subject created successfully",
            "subject": {
                "id": new_subject.id,
                "name": new_subject.name
            }
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

@professor_bp.route('/subjects', methods=['GET'])
@login_required
@professor_required
def get_professor_subjects():
    """Get all subjects created by the professor"""
    db = next(get_db())
    try:
        subjects = db.query(Subject).filter_by(professor_id=current_user.id).all()
        return jsonify({
            "subjects": [{
                "id": subject.id,
                "name": subject.name,
                "file_count": len(subject.files)
            } for subject in subjects]
        })
    finally:
        db.close()

@professor_bp.route('/subjects/<int:subject_id>/files', methods=['POST'])
@login_required
@professor_required
def add_subject_file(subject_id):
    """Add a file path to a subject"""
    db = next(get_db())
    try:
        subject = db.query(Subject).filter_by(
            id=subject_id, 
            professor_id=current_user.id
        ).first()
        
        if not subject:
            return jsonify({"error": "Subject not found or unauthorized"}), 404

        data = request.get_json()
        if not data or 'filepath' not in data:
            return jsonify({"error": "File path is required"}), 400

        # Secure the filename and create file entry
        filename = secure_filename(os.path.basename(data['filepath']))
        new_file = SubjectFile(
            filename=filename,
            path=data['filepath'],
            subject_id=subject_id
        )
        
        db.add(new_file)
        db.commit()

        return jsonify({
            "message": "File added successfully",
            "file": {
                "id": new_file.id,
                "filename": new_file.filename,
                "path": new_file.path
            }
        }), 201

    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()

@professor_bp.route('/subjects/<int:subject_id>/files', methods=['GET'])
@login_required
@professor_required
def get_subject_files(subject_id):
    """Get all files in a subject"""
    db = next(get_db())
    try:
        subject = db.query(Subject).filter_by(
            id=subject_id, 
            professor_id=current_user.id
        ).first()
        
        if not subject:
            return jsonify({"error": "Subject not found or unauthorized"}), 404

        return jsonify({
            "subject": subject.name,
            "files": [{
                "id": file.id,
                "filename": file.filename,
                "path": file.path
            } for file in subject.files]
        })
    finally:
        db.close()

@professor_bp.route('/subjects/<int:subject_id>', methods=['DELETE'])
@login_required
@professor_required
def delete_subject(subject_id):
    """Delete a subject and its associated files"""
    db = next(get_db())
    try:
        subject = db.query(Subject).filter_by(
            id=subject_id, 
            professor_id=current_user.id
        ).first()
        
        if not subject:
            return jsonify({"error": "Subject not found or unauthorized"}), 404

        db.delete(subject)
        db.commit()

        return jsonify({"message": "Subject deleted successfully"})
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()
        
        
        




@professor_bp.route('/subjects/files/<int:file_id>', methods=['DELETE'])
@login_required
@professor_required
def delete_subject_file(file_id):
    """Delete a specific file from a subject"""
    db = next(get_db())
    try:
        # Get the file and verify professor owns the associated subject
        file = db.query(SubjectFile).join(Subject).filter(
            SubjectFile.id == file_id,
            Subject.professor_id == current_user.id
        ).first()
        
        if not file:
            return jsonify({"error": "File not found or unauthorized"}), 404

        db.delete(file)
        db.commit()

        return jsonify({"message": "File deleted successfully"})
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()