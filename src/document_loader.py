"""
document_loader.py
Loads and processes documents from the knowledge base directory.
Uses UnstructuredFileLoader to handle multiple file types.
"""

from langchain.document_loaders import DirectoryLoader, UnstructuredFileLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from src.config import settings

def load_documents(directory="data/knowledge_base"):
    """
    Load documents from directory using UnstructuredFileLoader.
    Returns list of processed documents with metadata.
    """
    # Initialize DirectoryLoader with UnstructuredFileLoader
    loader = DirectoryLoader(
        directory,
        glob="**/[!.]*",  # ignore hidden files
        use_multithreading=True,
        show_progress=True,
        loader_cls=UnstructuredFileLoader,  # Use UnstructuredFileLoader for multiple file types
        loader_kwargs={"mode": "elements"}  # Optional: Split documents into elements
    )
    
    # Load and split documents
    raw_documents = loader.load()
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP
    )
    
    # Add metadata (source file) to each document
    documents = []
    for doc in raw_documents:
        metadata = doc.metadata
        metadata["source"] = metadata.get("source", "unknown")  # Ensure "source" exists
        documents.append(Document(
            page_content=doc.page_content,
            metadata=metadata
        ))
    
    return text_splitter.split_documents(documents)