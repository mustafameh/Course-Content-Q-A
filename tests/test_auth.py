"""
Authentication System Tests
Covers user creation, login, and session management
"""

import pytest
from src.models import Base, User
from src.auth.routes import auth_bp, configure_auth
from flask import Flask
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

@pytest.fixture(scope='module')
def test_engine():
    """Create test database engine"""
    return create_engine('sqlite:///:memory:')

@pytest.fixture(scope='module')
def app(test_engine):
    """Flask application fixture with test configuration"""
    app = Flask(__name__)
    app.secret_key = 'test-secret-key'
    
    # Configure authentication
    configure_auth(app)
    app.register_blueprint(auth_bp)
    
    # Configure test database
    Base.metadata.create_all(bind=test_engine)
    app.config['TEST_ENGINE'] = test_engine
    
    return app

@pytest.fixture
def db_session(app):
    """Create a fresh database session for each test"""
    connection = app.config['TEST_ENGINE'].connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(app, db_session):
    """Test client with database session injection"""
    # Inject test session into application context
    app.config['TEST_SESSION'] = db_session
    
    with app.test_client() as client:
        with app.app_context():
            yield client

def test_successful_user_creation(client):
    """Test valid user creation workflow"""
    response = client.post('/auth/users', json={
        'username': 'new_proff@uni.edu',
        'password': 'secure123',
        'role': 'professor'
    })
    assert response.status_code == 201
    assert b"User created successfully" in response.data

def test_invalid_role_creation(client):
    """Test user creation with invalid role"""
    response = client.post('/auth/users', json={
        'username': 'invalid@uni.edu',
        'password': 'test123',
        'role': 'admin'
    })
    assert response.status_code == 400
    assert b"Invalid role" in response.data

def test_duplicate_user_rejection(client):
    """Test duplicate username prevention"""
    # First creation
    client.post('/auth/users', json={
        'username': 'dupe@uni.edu',
        'password': 'test123'
    })
    
    # Duplicate attempt
    response = client.post('/auth/users', json={
        'username': 'dupe@uni.edu',
        'password': 'test123'
    })
    assert response.status_code == 409
    assert b"already exists" in response.data

def test_valid_login(client):
    """Test successful authentication workflow"""
    # Create test user
    client.post('/auth/users', json={
        'username': 'testuser@uni.edu',
        'password': 'validpass'
    })
    
    # Login attempt
    response = client.post('/auth/login', json={
        'username': 'testuser@uni.edu',
        'password': 'validpass'
    })
    assert response.status_code == 200
    assert b"Login successful" in response.data

def test_invalid_login(client):
    """Test failed authentication attempts"""
    # Test invalid credentials
    response = client.post('/auth/login', json={
        'username': 'nonexistent@uni.edu',
        'password': 'wrongpass'
    })
    assert response.status_code == 401
    assert b"Invalid credentials" in response.data