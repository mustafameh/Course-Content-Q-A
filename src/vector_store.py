""" vector_store.py
Manages vector store creation and similarity search using FAISS.
Handles embedding model initialization and storage persistence.
"""

"""vector_store.py"""
import os
from langchain.vectorstores import FAISS
from langchain.embeddings import HuggingFaceEmbeddings
from src.config import settings

class VectorStore:
    def __init__(self):
        self.embeddings = HuggingFaceEmbeddings(
            model_name=settings.EMBEDDING_MODEL
        )
        self.vector_store = None

    def _get_vector_store_path(self, professor_id, subject_id):
        """Generate path for vector store based on professor and subject"""
        base_path = os.path.join("data", "vector_bases", f"professor_{professor_id}", f"subject_{subject_id}")
        os.makedirs(base_path, exist_ok=True)
        return base_path

    def create_from_documents(self, documents, professor_id, subject_id):
        """Create vector store for specific subject and save to disk"""
        save_path = self._get_vector_store_path(professor_id, subject_id)
        self.vector_store = FAISS.from_documents(
            documents, self.embeddings
        )
        self.vector_store.save_local(save_path)
        return self.vector_store

    def load_subject_vector_store(self, professor_id, subject_id):
        """Load vector store for specific subject"""
        path = self._get_vector_store_path(professor_id, subject_id)
        if not os.path.exists(path):
            return None
        self.vector_store = FAISS.load_local(
            path, self.embeddings, allow_dangerous_deserialization=True
        )
        return self.vector_store