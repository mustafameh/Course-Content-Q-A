from flask import Flask, render_template, jsonify, current_app
from flask_cors import CORS
from src.auth import auth_bp, configure_auth
from src.models import Base, engine, User, get_db
import os
from contextlib import closing
from sqlalchemy import func
from flask import jsonify, request
from src.models import User, Subject, ProfessorProfile, GoogleDriveCredentials

app = Flask(__name__, 
    static_url_path='',
    static_folder='static',
    template_folder='templates'
)
CORS(app)

# Configure Flask-Login
app.config['SECRET_KEY'] = 'your-secret-key'  # Change this in production
configure_auth(app)

# Register blueprints
app.register_blueprint(auth_bp)

# Create database tables
Base.metadata.create_all(bind=engine)
from src.professor import professor_bp

# Add this line with your other blueprint registrations
app.register_blueprint(professor_bp)


@app.route('/')
def home():
    return render_template('index.html')

# Changed function name to login_page
@app.route('/login')
def login_page():
    return render_template('login/index.html')

from src.chat_bot_endpoints import chat_bp

# Add these with your other blueprint registrations
app.register_blueprint(chat_bp)

from src.faq_routes import faq_bp

# Add this with your other blueprint registrations
app.register_blueprint(faq_bp)

@app.route('/register')
def register():
    return render_template('register_page/register.html')

from flask import redirect, url_for
from flask_login import current_user

@app.route('/chat')
def chat():
    """Global chat view showing all subjects"""
    return render_template('chat_interface/index.html', view_type='global')

@app.route('/<professor_username>')
def professor_chat(professor_username):
    """Professor-specific chat view"""
    with closing(next(get_db())) as db:
        professor = User.get_by_url_username(professor_username, db)
        
        if not professor or professor.role != 'professor':
            return redirect(url_for('chat'))
            
        display_name = professor.username.split('@')[0]
            
        return render_template(
            'chat_interface/index.html',
            view_type='professor',
            professor_id=professor.id,
            professor_name=display_name
        )

@app.route('/api/professors/search')
def search_professors():
    """Search professors by name (username)"""
    query = request.args.get('query', '').lower()
    
    with closing(next(get_db())) as db:
        professors = db.query(User).filter(
            User.role == 'professor',
            User.username.ilike(f'%{query}%')
        ).all()
        
        results = [{
            'id': prof.id,
            'username': prof.username.split('@')[0],  # Remove email domain
            'url': f'/{prof.url_username}',
            'institution': prof.professor_profile.institution if prof.professor_profile else None
        } for prof in professors]
        
        return jsonify(results)

@app.route('/api/stats')
def get_stats():
    """Get platform statistics"""
    with closing(next(get_db())) as db:
        professor_count = db.query(func.count(User.id)).filter(User.role == 'professor').scalar()
        subject_count = db.query(func.count(Subject.id)).scalar()
        approved_professors = db.query(func.count(ProfessorProfile.id)).filter(ProfessorProfile.is_approved == True).scalar()
        
        # Count documents (based on subjects with drive folders)
        subjects_with_docs = db.query(Subject).filter(Subject.drive_folder_id.isnot(None)).count()
        
        stats = {
            'professorCount': approved_professors,
            'subjectCount': subject_count,
            'documentCount': subjects_with_docs  # This is an approximation
        }
        
        return jsonify(stats)

@app.route('/api/contact', methods=['POST'])
def submit_contact():
    """Handle contact form submissions"""
    data = request.json
    
    # Here you would typically:
    # 1. Validate the data
    # 2. Send an email
    # 3. Store in database if needed
    
    # For now, just return success
    return jsonify({
        'status': 'success',
        'message': 'Thank you for your message. We will get back to you soon!'
    })

















@app.context_processor
def inject_js_type():
    return dict(js_type='module' if not app.debug else 'text/javascript')

if __name__ == '__main__':
    app.run(debug=True)