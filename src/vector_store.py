""" Manages vector store creation and similarity search using FAISS.
Handles embedding model initialization and storage persistence.
"""

from langchain.vectorstores import FAISS
from langchain.embeddings import HuggingFaceEmbeddings
from src.config import settings

class VectorStore:
    def __init__(self):
        self.embeddings = HuggingFaceEmbeddings(
            model_name=settings.EMBEDDING_MODEL
        )
        self.vector_store = None

    def create_from_documents(self, documents, save_path="data/vector_base"):
        """Create vector store from documents and save to disk"""
        self.vector_store = FAISS.from_documents(
            documents, self.embeddings
        )
        self.vector_store.save_local(save_path)
        return self.vector_store

    def load_local(self, path="data/vector_base"):
        """Load existing vector store from disk"""
        self.vector_store = FAISS.load_local(
            path, self.embeddings, allow_dangerous_deserialization=True
        )
        return self.vector_store