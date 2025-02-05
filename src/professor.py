from flask import Blueprint, request, jsonify, session, redirect, url_for, request
from flask_login import login_required, current_user
from src.models import User, Subject, SubjectFile, get_db, GoogleDriveCredentials
from werkzeug.utils import secure_filename
import os
from functools import wraps
from sqlalchemy.orm import joinedload
from datetime import datetime
from src.google_drive.auth import GoogleDriveAuth
from src.google_drive.drive_service import GoogleDriveService

professor_bp = Blueprint('professor', __name__, url_prefix='/professor')

# Custom decorator to check if user is a professor and approved
def professor_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != 'professor':
            return jsonify({"error": "Professor access required"}), 403
        
        # Get fresh user object from database with relationships
        db = next(get_db())
        try:
            user = db.query(User).options(
                joinedload(User.professor_profile)
            ).get(current_user.id)
            
            if not (user.professor_profile and user.professor_profile.is_approved):
                return jsonify({"error": "Your professor account is pending approval"}), 403
                
            return f(*args, **kwargs)
        finally:
            db.close()
            
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
        

"""professor.py"""
# Add these imports
from src.vector_store import VectorStore
from src.document_loader import SubjectDocumentLoader

# Add these new endpoints
@professor_bp.route('/subjects/<int:subject_id>/knowledge-base', methods=['POST'])
@login_required
@professor_required
def create_subject_knowledge_base(subject_id):
    """Create or update knowledge base for a subject"""
    db = next(get_db())
    try:
        # Verify subject belongs to professor
        subject = db.query(Subject).filter_by(
            id=subject_id,
            professor_id=current_user.id
        ).first()
        
        if not subject:
            return jsonify({"error": "Subject not found or unauthorized"}), 404

        # Get all file paths for the subject
        file_paths = [file.path for file in subject.files]
        
        if not file_paths:
            return jsonify({"error": "No files found for this subject"}), 400

        # Load documents
        document_loader = SubjectDocumentLoader()
        documents = document_loader.load_subject_documents(file_paths)
        
        if not documents:
            return jsonify({"error": "No documents could be loaded"}), 400

        # Create vector store
        vector_store = VectorStore()
        vector_store.create_from_documents(
            documents,
            professor_id=current_user.id,
            subject_id=subject_id
        )

        return jsonify({
            "message": "Knowledge base created successfully",
            "document_count": len(documents)
        })

    except Exception as e:
        return jsonify({"error": f"Failed to create knowledge base: {str(e)}"}), 500
    finally:
        db.close()

@professor_bp.route('/subjects/<int:subject_id>/knowledge-base', methods=['GET'])
@login_required
@professor_required
def check_knowledge_base_status(subject_id):
    """Check if knowledge base exists for a subject"""
    try:
        vector_store = VectorStore()
        exists = vector_store.load_subject_vector_store(
            professor_id=current_user.id,
            subject_id=subject_id
        ) is not None

        return jsonify({
            "exists": exists,
            "subject_id": subject_id
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    
@professor_bp.route('/subjects/<int:subject_id>/status', methods=['GET'])
@login_required
@professor_required
def get_subject_status(subject_id):
    """Get detailed status of a subject including KB info"""
    db = next(get_db())
    try:
        subject = db.query(Subject).filter_by(
            id=subject_id, 
            professor_id=current_user.id
        ).first()
        
        if not subject:
            return jsonify({"error": "Subject not found"}), 404

        # Check knowledge base status
        vector_store = VectorStore()
        kb_exists = vector_store.load_subject_vector_store(
            professor_id=current_user.id,
            subject_id=subject_id
        ) is not None

        # Get KB path to check last modified time
        kb_path = vector_store._get_vector_store_path(
            professor_id=current_user.id,
            subject_id=subject_id
        )
        
        last_updated = None
        if os.path.exists(kb_path):
            last_updated = datetime.fromtimestamp(os.path.getmtime(kb_path)).strftime('%Y-%m-%d %H:%M:%S')

        return jsonify({
            "id": subject.id,
            "name": subject.name,
            "file_count": len(subject.files),
            "kb_exists": kb_exists,
            "last_updated": last_updated
        })

    finally:
        db.close()
        

@professor_bp.route('/profile', methods=['GET'])
@login_required
@professor_required
def get_professor_profile():
    """Get professor profile information"""
    db = next(get_db())
    try:
        user = db.query(User).options(
            joinedload(User.professor_profile)
        ).get(current_user.id)
        
        return jsonify({
            "email": user.username,
            "institution": user.professor_profile.institution,
            "department": user.professor_profile.department
        })
    finally:
        db.close()
        

@professor_bp.route('/google/auth/start')
@login_required
@professor_required
def start_google_auth():
    """Start Google OAuth flow"""
    google_auth = GoogleDriveAuth()
    auth_url, state = google_auth.get_authorization_url()
    
    # Store state in session for verification
    session['google_auth_state'] = state
    
    return jsonify({
        'auth_url': auth_url
    })

@professor_bp.route('/google/auth/callback')
@login_required
@professor_required
def oauth2callback():
    if 'error' in request.args:
        return jsonify({'error': request.args['error']}), 400

    if 'code' not in request.args:
        return jsonify({'error': 'No authorization code received'}), 400

    try:
        google_auth = GoogleDriveAuth()
        flow = google_auth.create_auth_flow(
            redirect_uri=url_for('professor.oauth2callback', _external=True)
        )
        
        # Exchange code for tokens
        flow.fetch_token(authorization_response=request.url)
        
        # Get credentials
        credentials = flow.credentials
        
        # Create token info dictionary
        token_info = {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }

        # Create Drive service and verify connection
        drive_service = GoogleDriveService(credentials)
        
        if not drive_service.verify_connection():
            return jsonify({'error': 'Failed to connect to Google Drive'}), 500

        # Create root folder
        folder_id = drive_service.create_root_folder(current_user.username)
        if not folder_id:
            return jsonify({'error': 'Failed to create root folder'}), 500

        # Store credentials in database
        db = next(get_db())
        try:
            # Check if credentials already exist
            existing_creds = db.query(GoogleDriveCredentials).filter_by(
                professor_id=current_user.id
            ).first()
            
            if existing_creds:
                # Update existing credentials
                existing_creds.token_info = token_info
                existing_creds.drive_folder_id = folder_id
                existing_creds.last_synced = datetime.utcnow()
                existing_creds.is_active = True
            else:
                # Create new credentials
                google_creds = GoogleDriveCredentials(
                    professor_id=current_user.id,
                    token_info=token_info,
                    drive_folder_id=folder_id,
                    connected_at=datetime.utcnow(),
                    last_synced=datetime.utcnow()
                )
                db.add(google_creds)
            
            db.commit()
            
            # Close the popup window and refresh the parent
            return """
                <script>
                    window.opener.postMessage('google-drive-connected', '*');
                    window.close();
                </script>
            """
            
        except Exception as e:
            db.rollback()
            return jsonify({'error': str(e)}), 500
        finally:
            db.close()

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@professor_bp.route('/google/status')
@login_required
@professor_required
def get_google_status():
    """Get Google Drive connection status"""
    db = next(get_db())
    try:
        creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()
        
        return jsonify({
            'connected': bool(creds),
            'last_synced': creds.last_synced.isoformat() if creds else None,
            'folder_id': creds.drive_folder_id if creds else None
        })
    finally:
        db.close()