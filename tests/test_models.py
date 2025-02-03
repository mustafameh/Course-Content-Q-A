# tests/test_models.py
import pytest
from src.models import User, Subject, Session

@pytest.fixture(scope="module")
def db_session():
    # Create new session for tests
    session = Session()
    yield session
    # Clean up after tests
    session.rollback()
    session.close()

def test_user_creation(db_session):
    # Test professor creation
    prof = User(username="cs_prof@uni.edu", role="professor")
    prof.set_password("secure123")
    db_session.add(prof)
    db_session.commit()
    
    retrieved = db_session.query(User).filter_by(username="cs_prof@uni.edu").first()
    assert retrieved is not None
    assert retrieved.check_password("secure123")
    assert retrieved.role == "professor"

def test_subject_creation(db_session):
    # Create professor
    prof = User(username="math_prof@uni.edu", role="professor")
    db_session.add(prof)
    db_session.commit()
    
    # Create subject
    subject = Subject(name="Linear Algebra 101", professor=prof)
    db_session.add(subject)
    db_session.commit()
    
    # Verify
    retrieved = db_session.query(Subject).filter_by(name="Linear Algebra 101").first()
    assert retrieved is not None
    assert retrieved.professor.username == "math_prof@uni.edu"

def test_subject_enrollment(db_session):
    # Create student
    student = User(username="student1@uni.edu", role="student")
    db_session.add(student)
    
    # Create professor
    prof = User(username="physics_prof@uni.edu", role="professor")
    
    # Create subject
    subject = Subject(name="Quantum Physics", professor=prof)
    
    # Enroll student
    subject.students.append(student)
    db_session.add_all([prof, subject])
    db_session.commit()
    
    # Verify relationships
    assert len(subject.students) == 1
    assert student in subject.students
    assert subject in student.enrolled_subjects