"""
document_loader.py
Loads and processes documents from the knowledge base directory.
Uses UnstructuredFileLoader to handle multiple file types.
"""
from langchain.document_loaders import UnstructuredFileLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from src.config import settings
from src.models import Subject, GoogleDriveCredentials, get_db
from src.google_drive.auth import GoogleDriveAuth
from src.google_drive.drive_service import GoogleDriveService
from typing import List
import os
import tempfile

class SubjectDocumentLoader:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP
        )

    def load_subject_documents(self, subject_id: int, professor_id: int) -> List[Document]:
        """Load documents from Google Drive"""
        db = next(get_db())
        try:
            # Get subject
            subject = db.query(Subject).filter_by(
                id=subject_id,
                professor_id=professor_id
            ).first()
            
            if not subject:
                raise Exception("Subject not found")

            if not subject.drive_folder_id:
                raise Exception("Subject is not Drive-enabled")

            return self._load_drive_documents(subject, professor_id)
                
        finally:
            db.close()

    def _load_drive_documents(self, subject: Subject, professor_id: int) -> List[Document]:
        """Load documents from Google Drive"""
        documents = []
        db = next(get_db())
        
        try:
            # Get Drive credentials
            drive_creds = db.query(GoogleDriveCredentials).filter_by(
                professor_id=professor_id,
                is_active=True
            ).first()
            
            if not drive_creds:
                raise Exception("No active Drive connection")

            # Initialize Drive service
            google_auth = GoogleDriveAuth()
            credentials = google_auth.get_credentials_from_token(drive_creds.token_info)
            drive_service = GoogleDriveService(credentials)
            
            # Get all files in folder
            files, _ = drive_service.list_folder_files(subject.drive_folder_id)
            
            # Create temporary directory for downloaded files
            with tempfile.TemporaryDirectory() as temp_dir:
                for file in files:
                    try:
                        # Download file to temp directory
                        temp_path = os.path.join(temp_dir, file['name'])
                        drive_service.download_file(file['id'], temp_path)
                        
                        # Load document using UnstructuredFileLoader
                        loader = UnstructuredFileLoader(temp_path)
                        docs = loader.load()
                        
                        # Add metadata
                        for doc in docs:
                            doc.metadata.update({
                                "source": file['name'],
                                "drive_file_id": file['id']
                            })
                        
                        documents.extend(docs)
                    except Exception as e:
                        print(f"Error processing file {file['name']}: {str(e)}")
                        continue
            
            return self.text_splitter.split_documents(documents)
            
        finally:
            db.close()