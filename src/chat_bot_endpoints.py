"""src/chat.py chat endpoints"""
"""src/chat.py"""
"""src/chat.py"""
from flask import Blueprint, request, jsonify, session
from src.models import Subject, get_db
from src.vector_store import VectorStore
from src.chat_bot import ChatBot
from contextlib import closing
import os

chat_bp = Blueprint('chat', __name__, url_prefix='/chat')

# Store conversation histories in session instead of ChatBot objects
def get_session_key(subject_id: int) -> str:
    return f"chat_history_{subject_id}"

@chat_bp.route('/subjects', methods=['GET'])
def get_available_subjects():
    """Get list of subjects that have knowledge bases"""
    try:
        # First get all vector bases that exist
        vector_base_path = os.path.join("data", "vector_bases")
        if not os.path.exists(vector_base_path):
            return jsonify({"subjects": []})

        available_subjects = []
        db = next(get_db())

        # Iterate through professor directories
        for professor_dir in os.listdir(vector_base_path):
            if professor_dir.startswith('professor_'):
                professor_path = os.path.join(vector_base_path, professor_dir)
                professor_id = int(professor_dir.split('_')[1])

                # Iterate through subject directories
                for subject_dir in os.listdir(professor_path):
                    if subject_dir.startswith('subject_'):
                        subject_id = int(subject_dir.split('_')[1])
                        
                        # Get subject details from database
                        subject = db.query(Subject).filter_by(
                            id=subject_id,
                            professor_id=professor_id
                        ).first()
                        
                        if subject:
                            available_subjects.append({
                                "id": subject.id,
                                "name": subject.name,
                                "professor_id": subject.professor_id
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
        
        # Here you would typically store the feedback in your database
        # For now, we'll just log it
        print(f"Question submitted for review - Subject {subject_id}:")
        print(f"Original Question: {data['originalQuestion']}")
        print(f"Question for Review: {data['questionForReview']}")
        print(f"Bot Response: {data['botResponse']}")
        
        # TODO: Add your database storage logic here
        
        return jsonify({"message": "Question received for review successfully"})
    except Exception as e:
        return jsonify({"error": f"Failed to process submission: {str(e)}"}), 500