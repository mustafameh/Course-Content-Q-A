from flask import Flask, render_template, jsonify, current_app
from flask_cors import CORS
from src.auth import auth_bp, configure_auth
from src.models import Base, engine, User, get_db
import os
from contextlib import closing

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

# Basic routes for testing
@app.route('/')
def home():
    return render_template('index.html')



from src.chat_bot_endpoints import chat_bp

# Add these with your other blueprint registrations
app.register_blueprint(chat_bp)

from src.faq_routes import faq_bp

# Add this with your other blueprint registrations
app.register_blueprint(faq_bp)

# Add this route

@app.route('/register')
def register():
    
    return render_template('register_page/register.html')


# In app.py (Add these new routes)

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
        # Use the new get_by_url_username method
        professor = User.get_by_url_username(professor_username, db)
        
        if not professor or professor.role != 'professor':
            return redirect(url_for('chat'))
            
        # Get the display name (without email domain)
        display_name = professor.username.split('@')[0]
            
        return render_template(
            'chat_interface/index.html',
            view_type='professor',
            professor_id=professor.id,
            professor_name=display_name
        )

if __name__ == '__main__':
    app.run(debug=True)
    
@app.context_processor
def inject_js_type():
    return dict(js_type='module' if not app.debug else 'text/javascript')