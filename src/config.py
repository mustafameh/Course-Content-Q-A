"""
config.py
Handles configuration and environment variables for the project.
Uses pydantic settings for validation.
"""

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    OPENROUTER_API_KEY: str
    OPENROUTER_URL: str = "https://openrouter.ai/api/v1"
    EMBEDDING_MODEL: str = "sentence-transformers/multi-qa-mpnet-base-dot-v1"
    LLM_MODEL: str = "google/palm-2-chat-bison"
    
    # For Vector base creation
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    
    # For vector search
    SIMILARITY_THRESHOLD: float = 0.8 # Adjust as needed
    NUMBER_OF_CHUNKS: int = 5
    
    # for chat history 
    MAX_HISTORY_LENGTH: int = 10  # Keep last 10 exchanges
    MAX_HISTORY_TOKENS: int = 3000  # Truncate if over
    
    
    
    class Config:
        env_file = ".env"

settings = Settings()