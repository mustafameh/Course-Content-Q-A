# tests/conftest.py
import pytest
from flask import Flask
from flask_login import LoginManager
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session
from src.models import Base, User
from auth import auth_bp
from src.professor import professor_bp
from contextlib import contextmanager, closing

def create_app(test_config=None):
    """Application factory for testing"""
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SECRET_KEY'] = 'test-secret-key'
    
    # Initialize Flask-Login
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    
    # Configure user loader
    @login_manager.user_loader
    def load_user(user_id):
        with app.db_session() as session:
            return session.get(User, int(user_id))
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(professor_bp)
    
    # Configure database
    engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'])
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    @contextmanager
    def _db_session():
        session = SessionLocal()
        try:
            yield session
            session.commit()
        except:
            session.rollback()
            raise
        finally:
            session.close()
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Add database session to app context
    app.db_session = _db_session
    app.db_engine = engine
    
    return app

# tests/conftest.py
@pytest.fixture
def client():
    app = create_app()
    with app.test_client() as client:
        with app.app_context():
            # Create test professor user
            with app.db_session() as session:
                professor = User(
                    username='prof@uni.edu',
                    role='professor'
                )
                professor.set_password('password')
                session.add(professor)
                session.commit()
            
            # Manually commit all changes before yielding
            session.commit()
            
        yield client

        # Clean up after tests
        with app.app_context():
            Base.metadata.drop_all(bind=app.db_engine)