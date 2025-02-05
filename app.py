from flask import Flask, render_template, jsonify, current_app
from flask_cors import CORS
from src.auth import auth_bp, configure_auth
from src.models import Base, engine
import os

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

@app.route('/professor-dashboard')
def professor_test():
    template_path = os.path.join(current_app.template_folder, 'professor_dashboard', 'index.html')
    print(f"Looking for template at: {template_path}")
    return render_template('professor_dashboard/index.html')



from src.chat_bot_endpoints import chat_bp

# Add these with your other blueprint registrations
app.register_blueprint(chat_bp)

# Add this route
@app.route('/chat')
def chat():
    return render_template('chat.html')

@app.route('/register')
def register():
    return render_template('register.html')

if __name__ == '__main__':
    app.run(debug=True)