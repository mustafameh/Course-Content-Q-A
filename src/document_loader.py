"""
document_loader.py
Loads and processes documents from the knowledge base directory.
Uses UnstructuredFileLoader to handle multiple file types.
"""

from langchain.document_loaders import DirectoryLoader, UnstructuredFileLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from src.config import settings

"""document_loader.py"""
from langchain.document_loaders import UnstructuredFileLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from src.config import settings
from typing import List
import os

class SubjectDocumentLoader:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP
        )

    def load_subject_documents(self, file_paths: List[str]) -> List[Document]:
        """Load documents from provided file paths"""
        documents = []
        
        for file_path in file_paths:
            if not os.path.exists(file_path):
                print(f"Warning: File not found - {file_path}")
                continue
                
            try:
                loader = UnstructuredFileLoader(file_path)
                docs = loader.load()
                
                # Add metadata
                for doc in docs:
                    doc.metadata["source"] = file_path
                
                documents.extend(docs)
            except Exception as e:
                print(f"Error loading file {file_path}: {str(e)}")
                continue

        return self.text_splitter.split_documents(documents)