"""
Database models and session management
Core tables: Users, Subjects, SubjectFiles, SubjectEnrollment
"""

from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Table
from sqlalchemy.orm import declarative_base, relationship, scoped_session, sessionmaker
from passlib.hash import bcrypt
from sqlalchemy.orm import validates
from flask_login import UserMixin  # Added UserMixin

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

class Subject(Base):
    """Course subject model"""
    __tablename__ = 'subjects'
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    professor_id = Column(Integer, ForeignKey('users.id'))
    
    # Relationships
    professor = relationship('User', back_populates='created_subjects')
    students = relationship('User', secondary=subject_enrollment, back_populates='enrolled_subjects')
    files = relationship('SubjectFile', back_populates='subject')

class SubjectFile(Base):
    """Course material files model"""
    __tablename__ = 'subject_files'
    id = Column(Integer, primary_key=True)
    filename = Column(String(255), nullable=False)
    path = Column(String(255), nullable=False)
    subject_id = Column(Integer, ForeignKey('subjects.id'))
    
    # Relationships
    subject = relationship('Subject', back_populates='files')

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