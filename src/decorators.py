from functools import wraps
from flask import redirect, flash, request
from flask_login import current_user
from src.models import User, get_db
from sqlalchemy.orm import joinedload

def professor_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            # Redirect to root URL which has the login form
            return redirect(f'/?next={request.path}')
        
        if current_user.role != 'professor':
            flash('This area is restricted to professors only.', 'error')
            return redirect('/')
        
        db = next(get_db())
        try:
            user = db.query(User).options(
                joinedload(User.professor_profile)
            ).get(current_user.id)
            
            if not (user.professor_profile and user.professor_profile.is_approved):
                flash("Your professor account is pending approval", "warning")
                return redirect('/')
                
            return f(*args, **kwargs)
        finally:
            db.close()
            
    return decorated_function