"""
Authentication Blueprint
Endpoints: /auth/login, /auth/logout, /auth/users
"""

from flask import Blueprint, request, jsonify
from flask_login import LoginManager, login_user, logout_user, current_user
from src.models import User, get_db
from contextlib import closing

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')
login_manager = LoginManager()

def configure_auth(app):
    """Initialize authentication system with Flask app"""
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'  # Set login view endpoint

@login_manager.user_loader
def load_user(user_id):
    """User loader callback for Flask-Login"""
    with closing(next(get_db())) as session:
        return session.query(User).get(int(user_id))

@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate user and create session"""
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({"error": "Missing credentials"}), 400
    
    with closing(next(get_db())) as session:
        user = session.query(User).filter_by(username=data['username']).first()
        if not user or not user.check_password(data['password']):
            return jsonify({"error": "Invalid credentials"}), 401
        
        login_user(user)
        return jsonify({
            "message": "Login successful",
            "user": {
                "id": user.id,
                "role": user.role,
                "username": user.username
            }
        })

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Terminate user session"""
    if not current_user.is_authenticated:
        return jsonify({"error": "Not logged in"}), 401
    
    logout_user()
    return jsonify({"message": "Logged out successfully"})

@auth_bp.route('/users', methods=['POST'])
def create_user():
    """Create new user account with validation"""
    data = request.get_json()
    required_fields = ['username', 'password']
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400
    
    with closing(next(get_db())) as session:
        # Check for existing user
        if session.query(User).filter_by(username=data['username']).first():
            return jsonify({"error": "Username already exists"}), 409
        
        try:
            new_user = User(
                username=data['username'],
                role=data.get('role', 'student').lower()
            )
            new_user.set_password(data['password'])
            session.add(new_user)
            session.commit()
            return jsonify({
                "message": "User created successfully",
                "user_id": new_user.id
            }), 201
        except ValueError as e:
            session.rollback()
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            session.rollback()
            return jsonify({"error": "Server error: " + str(e)}), 500