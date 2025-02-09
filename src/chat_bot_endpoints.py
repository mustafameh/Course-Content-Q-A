"""src/chat.py chat endpoints"""
"""src/chat.py"""
"""src/chat.py"""
from flask import Blueprint, request, jsonify, session
from src.models import Subject, get_db
from src.vector_store import VectorStore
from src.chat_bot import ChatBot
from contextlib import closing
import os
from src.models import GoogleDriveCredentials
from src.google_drive.auth import GoogleDriveAuth
from src.google_drive.drive_service import GoogleDriveService


chat_bp = Blueprint('chat', __name__, url_prefix='/chat')

# Store conversation histories in session instead of ChatBot objects
def get_session_key(subject_id: int) -> str:
    return f"chat_history_{subject_id}"

@chat_bp.route('/subjects', methods=['GET'])
def get_available_subjects():
    """Get list of subjects that have knowledge bases"""
    try:
        professor_id = request.args.get('professor_id', None)
        
        vector_base_path = os.path.join("data", "vector_bases")
        if not os.path.exists(vector_base_path):
            return jsonify({"subjects": []})
            
        available_subjects = []
        db = next(get_db())
        
        query = db.query(Subject)
        
        # Filter by professor if specified
        if professor_id:
            query = query.filter(Subject.professor_id == professor_id)
            
        subjects = query.all()
        
        for subject in subjects:
            # Check if vector store exists for this subject
            professor_dir = f'professor_{subject.professor_id}'
            subject_dir = f'subject_{subject.id}'
            subject_path = os.path.join(vector_base_path, professor_dir, subject_dir)
            
            if os.path.exists(subject_path):
                available_subjects.append({
                    "id": subject.id,
                    "name": subject.name,
                    "professor_id": subject.professor_id,
                    "professor_name": subject.professor.username.split('@')[0]
                })
                
        return jsonify({"subjects": available_subjects})
        
    except Exception as e:
        print(f"Error loading subjects: {str(e)}")
        return jsonify({"error": f"Failed to load subjects: {str(e)}"}), 500
    finally:
        db.close()

@chat_bp.route('/initialize/<int:subject_id>', methods=['POST'])
def initialize_chatbot(subject_id):
    """Initialize chat session for a subject"""
    with closing(next(get_db())) as db:
        subject = db.query(Subject).get(subject_id)
        if not subject:
            return jsonify({"error": "Subject not found"}), 404

        vector_store = VectorStore()
        subject_vector_store = vector_store.load_subject_vector_store(
            professor_id=subject.professor_id,
            subject_id=subject.id
        )
        
        if not subject_vector_store:
            return jsonify({"error": "No knowledge base found for this subject"}), 404

        # Initialize empty conversation history in session
        session[get_session_key(subject_id)] = []
        
        return jsonify({
            "message": "Chat initialized successfully",
            "subject": {
                "id": subject.id,
                "name": subject.name
            }
        })

@chat_bp.route('/query/<int:subject_id>', methods=['POST'])
def query_chatbot(subject_id):
    """Query the chatbot for a specific subject"""
    session_key = get_session_key(subject_id)
    
    if session_key not in session:
        return jsonify({"error": "Please initialize the chat first"}), 400

    data = request.get_json()
    if not data or 'question' not in data:
        return jsonify({"error": "Question is required"}), 400

    try:
        with closing(next(get_db())) as db:
            subject = db.query(Subject).get(subject_id)
            if not subject:
                return jsonify({"error": "Subject not found"}), 404

            # Create a new ChatBot instance for this query
            vector_store = VectorStore()
            subject_vector_store = vector_store.load_subject_vector_store(
                professor_id=subject.professor_id,
                subject_id=subject.id
            )
            
            if not subject_vector_store:
                return jsonify({"error": "Knowledge base not found"}), 404

            chatbot = ChatBot(subject_vector_store, subject.name)
            
            # Load conversation history from session
            chatbot.conversation_history = session[session_key]
            
            # Get response
            response = chatbot.query(data['question'])
            
            # Update session with new conversation history
            session[session_key] = chatbot.conversation_history
            
            return jsonify({
                "response": response,
                "subject_id": subject_id
            })
    except Exception as e:
        return jsonify({"error": f"Error processing query: {str(e)}"}), 500

@chat_bp.route('/<int:subject_id>/history', methods=['GET'])
def get_chat_history(subject_id):
    """Get conversation history for a subject"""
    session_key = get_session_key(subject_id)
    return jsonify({
        "history": session.get(session_key, []),
        "subject_id": subject_id
    })

@chat_bp.route('/<int:subject_id>/reset', methods=['POST'])
def reset_chat(subject_id):
    """Reset chat history for a subject"""
    session_key = get_session_key(subject_id)
    if session_key in session:
        session[session_key] = []
    
    return jsonify({"message": "Chat history reset successfully"})
   
@chat_bp.route('/feedback/<int:subject_id>', methods=['POST'])
def submit_feedback(subject_id):
    """Handle feedback submission"""
    try:
        data = request.get_json()
        
        db = next(get_db())
        try:
            # Get subject and verify it exists
            subject = db.query(Subject).get(subject_id)
            if not subject:
                return jsonify({"error": "Subject not found"}), 404
                
            if not subject.faq_file_id:
                return jsonify({"error": "FAQ system not initialized for this subject"}), 400
                
            # Get Drive credentials
            drive_creds = db.query(GoogleDriveCredentials).filter_by(
                professor_id=subject.professor_id,
                is_active=True
            ).first()
            
            if not drive_creds:
                return jsonify({"error": "Drive not connected"}), 403
                
            # Initialize Drive service
            google_auth = GoogleDriveAuth()
            credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
            drive_service = GoogleDriveService(credentials)
            
            # Update FAQ file
            drive_service.update_faq_file(
                subject.faq_file_id,
                data['questionForReview']
            )
            
            return jsonify({"message": "Question submitted successfully"})
            
        finally:
            db.close()
            
    except Exception as e:
        return jsonify({"error": f"Failed to process feedback: {str(e)}"}), 500