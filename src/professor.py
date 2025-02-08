from flask import Blueprint, request, jsonify, session, redirect, url_for, request
from flask_login import login_required, current_user
from src.models import User, Subject, get_db, GoogleDriveCredentials
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
        
        # Get Drive service if available
        drive_service = None
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()
        
        if drive_creds:
            google_auth = GoogleDriveAuth()
            credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
            drive_service = GoogleDriveService(credentials)

        return jsonify({
            "subjects": [{
                "id": subject.id,
                "name": subject.name,
                "file_count": subject.get_file_count(drive_service),
                "drive_folder_id": subject.drive_folder_id,
                "drive_enabled": subject.is_drive_enabled
            } for subject in subjects]
        })
    finally:
        db.close()




        

"""professor.py"""
# Add these imports
from src.vector_store import VectorStore
from src.document_loader import SubjectDocumentLoader

@professor_bp.route('/subjects/<int:subject_id>/knowledge-base', methods=['POST'])
@login_required
@professor_required
def create_subject_knowledge_base(subject_id):
    """Sync files and create/update knowledge base for a subject"""
    db = next(get_db())
    try:
        # Verify subject belongs to professor
        subject = db.query(Subject).filter_by(
            id=subject_id,
            professor_id=current_user.id
        ).first()

        if not subject:
            return jsonify({"error": "Subject not found or unauthorized"}), 404

        # Get Drive credentials
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()
        
        if not drive_creds:
            return jsonify({"error": "Drive not connected"}), 403

        # Initialize Drive service and sync files
        google_auth = GoogleDriveAuth()
        credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
        drive_service = GoogleDriveService(credentials)
        
        # Sync files first
        drive_service.sync_folder(subject.drive_folder_id)
        
        # Update last synced time
        drive_creds.last_synced = datetime.utcnow()
        db.commit()

        # Load documents
        document_loader = SubjectDocumentLoader()
        documents = document_loader.load_subject_documents(
            subject_id=subject_id,
            professor_id=current_user.id
        )
        
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
            "message": "Files synced and knowledge base updated successfully",
            "document_count": len(documents)
        })

    except Exception as e:
        print(f"Error updating knowledge base: {str(e)}")
        return jsonify({"error": f"Failed to update: {str(e)}"}), 500
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
    """Handle Google OAuth callback"""
    if 'error' in request.args:
        return jsonify({'error': request.args['error']}), 400

    if 'code' not in request.args:
        return jsonify({'error': 'No authorization code received'}), 400

    try:
        # Get the authorization code
        google_auth = GoogleDriveAuth()
        flow = google_auth.create_auth_flow(
            redirect_uri=url_for('professor.oauth2callback', _external=True)
        )
        
        # Exchange code for tokens
        token_info = google_auth.process_oauth2_callback(flow, request.args['code'])
        
        # Create Drive service and verify connection
        credentials = google_auth.get_credentials_from_token(token_info)
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
                    last_synced=datetime.utcnow(),
                    is_active=True
                )
                db.add(google_creds)
            
            db.commit()
            
            # Return success HTML that closes the popup and refreshes the parent
            return """
                <script>
                    window.opener.postMessage('google-drive-connected', '*');
                    window.close();
                </script>
            """
            
        except Exception as e:
            db.rollback()
            print(f"Database error in oauth2callback: {str(e)}")
            return jsonify({'error': str(e)}), 500
        finally:
            db.close()

    except Exception as e:
        print(f"Error in oauth2callback: {str(e)}")
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
            'last_synced': creds.last_synced.isoformat() if creds and creds.last_synced else None,
            'folder_id': creds.drive_folder_id if creds else None
        })
    finally:
        db.close()
        
@professor_bp.route('/drive/subjects', methods=['POST'])
@login_required
@professor_required
def create_drive_subject():
    """Create a new subject with Drive folder"""
    data = request.get_json()
    
    if not data or 'name' not in data:
        return jsonify({"error": "Subject name is required"}), 400
        
    db = next(get_db())
    try:
        # Check Drive connection first
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()
        
        if not drive_creds:
            return jsonify({
                "error": "Google Drive connection required to create subjects"
            }), 403
            
        # Create subject in database
        new_subject = Subject(
            name=data['name'],
            professor_id=current_user.id
        )
        db.add(new_subject)
        db.flush()  # Get subject ID without committing
        
        # Create Drive folder
        google_auth = GoogleDriveAuth()
        credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
        drive_service = GoogleDriveService(credentials)
        
        folder_id = drive_service.create_subject_folder(
            drive_creds.drive_folder_id,
            data['name']
        )
        
        if not folder_id:
            db.rollback()
            return jsonify({
                "error": "Failed to create Drive folder for subject"
            }), 500
            
        # Create FAQ file
        try:
            faq_file_id = drive_service.create_faq_file(folder_id)
            new_subject.faq_file_id = faq_file_id  # Add this field to your Subject model
        except Exception as e:
            print(f"Error creating FAQ file: {e}")
            # Continue even if FAQ file creation fails
            
        # Update subject with folder info
        new_subject.drive_folder_id = folder_id
        new_subject.drive_folder_created = datetime.utcnow()
        
        db.commit()
        
        return jsonify({
            "message": "Subject created successfully",
            "subject": {
                "id": new_subject.id,
                "name": new_subject.name,
                "drive_folder_id": folder_id,
                "faq_file_id": faq_file_id
            }
        }), 201
        
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()       


@professor_bp.route('/drive/subjects', methods=['GET'])
@login_required
@professor_required
def get_drive_subjects():
    """Get all subjects with Drive status"""
    db = next(get_db())
    try:
        # Get Drive connection status
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()
        
        drive_connected = bool(drive_creds)
        drive_service = None
        
        if drive_creds:
            google_auth = GoogleDriveAuth()
            credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
            drive_service = GoogleDriveService(credentials)

        subjects = db.query(Subject).filter_by(professor_id=current_user.id).all()
        
        return jsonify({
            "drive_connected": drive_connected,
            "subjects": [{
                "id": subject.id,
                "name": subject.name,
                "drive_folder_id": subject.drive_folder_id,
                "file_count": subject.get_file_count(drive_service),
                "drive_enabled": subject.is_drive_enabled
            } for subject in subjects]
        })
    finally:
        db.close()

@professor_bp.route('/drive/subjects/<int:subject_id>', methods=['DELETE'])
@login_required
@professor_required
def delete_drive_subject(subject_id):
    """Delete subject , knowledge base and its Drive folder"""
    db = next(get_db())
    try:
        subject = db.query(Subject).filter_by(
            id=subject_id,
            professor_id=current_user.id
        ).first()

        if not subject:
            return jsonify({"error": "Subject not found"}), 404
            
        if subject.drive_folder_id:
            # Get Drive credentials
            drive_creds = db.query(GoogleDriveCredentials).filter_by(
                professor_id=current_user.id,
                is_active=True
            ).first()
            
            if drive_creds:
                # Delete Drive folder
                google_auth = GoogleDriveAuth()
                credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
                drive_service = GoogleDriveService(credentials)
                
                try:
                    drive_service.delete_folder(subject.drive_folder_id)
                except Exception as e:
                    print(f"Error deleting Drive folder: {str(e)}")
                    # Continue with deletion even if Drive folder deletion fails
            
            # Delete vector store if it exists
            vector_store = VectorStore()
            vector_store_path = vector_store._get_vector_store_path(
                professor_id=current_user.id,
                subject_id=subject_id
            )
            if os.path.exists(vector_store_path):
                try:
                    import shutil
                    shutil.rmtree(vector_store_path)
                except Exception as e:
                    print(f"Error deleting vector store: {str(e)}")
    
        # Delete subject from database
        db.delete(subject)
        db.commit()
        
        return jsonify({"message": "Subject deleted successfully"})
        
    except Exception as e:
        db.rollback()
        print(f"Error in delete_drive_subject: {str(e)}")
        return jsonify({"error": "Failed to delete subject"}), 500
    finally:
        db.close()
        
        
from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
from src.models import Subject, GoogleDriveCredentials, get_db
from src.google_drive.drive_service import GoogleDriveService
from src.google_drive.auth import GoogleDriveAuth
from datetime import datetime
import mimetypes
import os

# File Upload Configuration
ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'xls', 'xlsx'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# File Upload Routes
@professor_bp.route('/drive/subjects/<int:subject_id>/upload', methods=['POST'])
@login_required
@professor_required
def upload_to_drive(subject_id):
    """Upload file to Google Drive subject folder"""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
        
    file = request.files['file']
    if not file or not file.filename:
        return jsonify({"error": "No file selected"}), 400
        
    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400
        
    if file.content_length and file.content_length > MAX_FILE_SIZE:
        return jsonify({"error": "File size exceeds limit"}), 400

    db = next(get_db())
    try:
        # Get subject and verify ownership
        subject = db.query(Subject).filter_by(
            id=subject_id,
            professor_id=current_user.id
        ).first()
        
        if not subject or not subject.drive_folder_id:
            return jsonify({"error": "Subject not found or not Drive-enabled"}), 404
            
        # Get Drive credentials
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()
        
        if not drive_creds:
            return jsonify({"error": "Drive not connected"}), 403
            
        # Initialize Drive service
        google_auth = GoogleDriveAuth()
        credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
        drive_service = GoogleDriveService(credentials)
        
        # Upload file
        filename = secure_filename(file.filename)
        mime_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        
        file_metadata = {
            'name': filename,
            'parents': [subject.drive_folder_id],
            'mimeType': mime_type
        }
        
        uploaded_file = drive_service.upload_file(file, file_metadata)
        
        return jsonify({
            "message": "File uploaded successfully",
            "file": {
                "id": uploaded_file.get('id'),
                "name": uploaded_file.get('name'),
                "mimeType": uploaded_file.get('mimeType')
            }
        })
        
    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({"error": "Failed to upload file"}), 500
    finally:
        db.close()

@professor_bp.route('/drive/subjects/<int:subject_id>/files', methods=['GET'])
@login_required
@professor_required
def get_drive_files(subject_id):
    """Get files from Drive subject folder"""
    page = int(request.args.get('page', 1))
    search = request.args.get('search', '')
    items_per_page = 10
    
    db = next(get_db())
    try:
        # Verify subject ownership
        subject = db.query(Subject).filter_by(
            id=subject_id,
            professor_id=current_user.id
        ).first()
        
        if not subject or not subject.drive_folder_id:
            return jsonify({"error": "Subject not found or not Drive-enabled"}), 404
            
        # Get Drive credentials
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()
        
        if not drive_creds:
            return jsonify({"error": "Drive not connected"}), 403
            
        # Initialize Drive service
        google_auth = GoogleDriveAuth()
        credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
        drive_service = GoogleDriveService(credentials)
        
        # Get files with pagination
        files, total_files = drive_service.list_folder_files(
            subject.drive_folder_id,
            search_term=search,
            page=page,
            page_size=items_per_page
        )
        
        total_pages = (total_files + items_per_page - 1) // items_per_page
        
        return jsonify({
            "files": files,
            "currentPage": page,
            "totalPages": total_pages,
            "totalFiles": total_files
        })
        
    except Exception as e:
        print(f"Error listing files: {str(e)}")
        return jsonify({"error": "Failed to list files"}), 500
    finally:
        db.close()

@professor_bp.route('/drive/files/<file_id>/preview', methods=['GET'])
@login_required
@professor_required
def get_file_preview(file_id):
    """Get preview information for a Drive file"""
    db = next(get_db())
    try:
        # Get Drive credentials
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()
        
        if not drive_creds:
            return jsonify({"error": "Drive not connected"}), 403
            
        # Initialize Drive service
        google_auth = GoogleDriveAuth()
        credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
        drive_service = GoogleDriveService(credentials)
        
        # Get file metadata and preview URL
        file_info = drive_service.get_file_info(file_id)
        
        return jsonify({
            "id": file_info.get('id'),
            "name": file_info.get('name'),
            "mimeType": file_info.get('mimeType'),
            "size": file_info.get('size'),
            "modifiedTime": file_info.get('modifiedTime'),
            "previewUrl": drive_service.get_preview_url(file_id)
        })
        
    except Exception as e:
        print(f"Error getting preview: {str(e)}")
        return jsonify({"error": "Failed to get file preview"}), 500
    finally:
        db.close()

@professor_bp.route('/drive/files/<file_id>', methods=['DELETE'])
@login_required
@professor_required
def delete_drive_file(file_id):
    """Delete file from Drive"""
    db = next(get_db())
    try:
        # Get Drive credentials
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()
        
        if not drive_creds:
            return jsonify({"error": "Drive not connected"}), 403
            
        # Initialize Drive service
        google_auth = GoogleDriveAuth()
        credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
        drive_service = GoogleDriveService(credentials)
        
        # Delete file
        drive_service.delete_file(file_id)
        
        return jsonify({"message": "File deleted successfully"})
        
    except Exception as e:
        print(f"Error deleting file: {str(e)}")
        return jsonify({"error": "Failed to delete file"}), 500
    finally:
        db.close()

@professor_bp.route('/drive/subjects/<int:subject_id>/sync', methods=['POST'])
@login_required
@professor_required
def sync_drive_files(subject_id):
    """Sync files from Drive folder"""
    db = next(get_db())
    try:
        # Verify subject ownership
        subject = db.query(Subject).filter_by(
            id=subject_id,
            professor_id=current_user.id
        ).first()
        
        if not subject or not subject.drive_folder_id:
            return jsonify({"error": "Subject not found or not Drive-enabled"}), 404
            
        # Get Drive credentials
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()
        
        if not drive_creds:
            return jsonify({"error": "Drive not connected"}), 403
            
        # Initialize Drive service
        google_auth = GoogleDriveAuth()
        credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
        drive_service = GoogleDriveService(credentials)
        
        # Sync files
        drive_service.sync_folder(subject.drive_folder_id)
        
        # Update last synced time
        drive_creds.last_synced = datetime.utcnow()
        db.commit()
        
        return jsonify({"message": "Files synced successfully"})
        
    except Exception as e:
        print(f"Error syncing files: {str(e)}")
        return jsonify({"error": "Failed to sync files"}), 500
    finally:
        db.close()
        
@professor_bp.route('/drive/subjects/<int:subject_id>', methods=['PUT'])
@login_required
@professor_required
def update_drive_subject(subject_id):
    """Update subject name and description"""
    data = request.get_json()
    if not data or ('name' not in data and 'description' not in data):
        return jsonify({"error": "Name or description required"}), 400

    db = next(get_db())
    try:
        # Get subject and verify ownership
        subject = db.query(Subject).filter_by(
            id=subject_id,
            professor_id=current_user.id
        ).first()

        if not subject:
            return jsonify({"error": "Subject not found"}), 404

        # Get Drive credentials
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()

        if not drive_creds:
            return jsonify({"error": "Drive not connected"}), 403

        # Initialize Drive service
        google_auth = GoogleDriveAuth()
        credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
        drive_service = GoogleDriveService(credentials)

        # Update Drive folder name if name is being changed
        if 'name' in data and data['name'] != subject.name:
            try:
                drive_service.update_folder_name(subject.drive_folder_id, data['name'])
                subject.name = data['name']
            except Exception as e:
                return jsonify({"error": f"Failed to update Drive folder: {str(e)}"}), 500

        # Update description if provided
        if 'description' in data:
            subject.description = data['description']

        db.commit()

        return jsonify({
            "message": "Subject updated successfully",
            "subject": {
                "id": subject.id,
                "name": subject.name,
                "description": subject.description,
                "drive_folder_id": subject.drive_folder_id
            }
        })

    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to update subject: {str(e)}"}), 500
    finally:
        db.close()
        
@professor_bp.route('/drive/files/<file_id>/rename', methods=['PUT'])
@login_required
@professor_required
def rename_drive_file(file_id):
    """Rename a file in Google Drive"""
    data = request.get_json()
    if not data or 'new_name' not in data:
        return jsonify({"error": "New filename is required"}), 400

    new_name = secure_filename(data['new_name'])
    if not new_name:
        return jsonify({"error": "Invalid filename"}), 400

    db = next(get_db())
    try:
        # Get Drive credentials
        drive_creds = db.query(GoogleDriveCredentials).filter_by(
            professor_id=current_user.id,
            is_active=True
        ).first()
        
        if not drive_creds:
            return jsonify({"error": "Drive not connected"}), 403
            
        # Initialize Drive service
        google_auth = GoogleDriveAuth()
        credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
        drive_service = GoogleDriveService(credentials)
        
        # Rename file
        updated_file = drive_service.rename_file(file_id, new_name)
        
        return jsonify({
            "message": "File renamed successfully",
            "file": {
                "id": updated_file.get('id'),
                "name": updated_file.get('name'),
                "mimeType": updated_file.get('mimeType'),
                "modifiedTime": updated_file.get('modifiedTime')
            }
        })
        
    except Exception as e:
        print(f"Error renaming file: {str(e)}")
        return jsonify({"error": "Failed to rename file"}), 500
    finally:
        db.close()