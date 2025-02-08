"""
Database models and session management
Core tables: Users, Subjects, SubjectFiles, SubjectEnrollment
"""

from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Table, Boolean, DateTime
from sqlalchemy.orm import declarative_base, relationship, scoped_session, sessionmaker
from passlib.hash import bcrypt
from sqlalchemy.orm import validates
from flask_login import UserMixin  # Added UserMixin
from datetime import datetime
from sqlalchemy.types import JSON



Base = declarative_base()

# Association table for subject enrollment
subject_enrollment = Table(
    'subject_enrollment', Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('subject_id', Integer, ForeignKey('subjects.id'))
)

class User(Base, UserMixin):  # Added UserMixin
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(128))
    role = Column(String(20), nullable=False)  # 'professor' or 'student'
    
    # Relationships
    created_subjects = relationship('Subject', back_populates='professor')
    enrolled_subjects = relationship('Subject', secondary=subject_enrollment, back_populates='students')
    professor_profile = relationship('ProfessorProfile', back_populates='user', uselist=False)
    google_drive = relationship('GoogleDriveCredentials', back_populates='professor', uselist=False)
    

    def set_password(self, password):
        self.password_hash = bcrypt.hash(password)

    def check_password(self, password):
        return bcrypt.verify(password, self.password_hash)
    
    # Flask-Login required methods
    def get_id(self):
        return str(self.id)  # Convert to string as required by Flask-Login

    @validates('role')
    def validate_role(self, key, role):
        """Validate user role"""
        if role.lower() not in {'professor', 'student'}:
            raise ValueError("Invalid role. Must be 'professor' or 'student'")
        return role.lower()

    @validates('username')
    def validate_username(self, key, username):
        """Validate email format"""
        if '@' not in username:
            raise ValueError("Username must be a valid email address")
        return username
    


    
    
class ProfessorProfile(Base):
    __tablename__ = 'professor_profiles'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    institution = Column(String(100))
    department = Column(String(100))
    registration_reason = Column(String(500))
    is_approved = Column(Boolean, default=False)
    registration_date = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    user = relationship('User', back_populates='professor_profile')
    
    
class Subject(Base):
    __tablename__ = 'subjects'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)  # Add this line
    professor_id = Column(Integer, ForeignKey('users.id'))
    drive_folder_id = Column(String(100))
    faq_file_id = Column(String)
    
    drive_folder_created = Column(DateTime)

    # Relationships
    professor = relationship('User', back_populates='created_subjects')
    students = relationship('User', secondary=subject_enrollment, back_populates='enrolled_subjects')

    @property
    def is_drive_enabled(self):
        return bool(self.drive_folder_id)

    def get_file_count(self, drive_service=None):
        """Get file count from Drive folder"""
        if not self.drive_folder_id:
            return 0
        if not drive_service:
            return 0
        try:
            files, _ = drive_service.list_folder_files(self.drive_folder_id)
            return len(files)
        except:
            return 0
    
    
# Add to your existing models.py
class GoogleDriveCredentials(Base):
    __tablename__ = 'google_drive_credentials'
    
    id = Column(Integer, primary_key=True)
    professor_id = Column(Integer, ForeignKey('users.id'), unique=True)
    token_info = Column(JSON)  # Stores the OAuth2 tokens
    drive_folder_id = Column(String(100))  # Root folder ID in Drive
    connected_at = Column(DateTime, default=datetime.utcnow)
    last_synced = Column(DateTime)
    is_active = Column(Boolean, default=True)
    # Relationship
    professor = relationship('User', back_populates='google_drive')
    
    
    
# Database configuration
engine = create_engine('sqlite:///university.db')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def get_db():
    """Database session generator for dependency injection"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        
        
        
        
        
        
        
        
        
        
        