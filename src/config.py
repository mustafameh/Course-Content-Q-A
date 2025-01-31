"""
Handles configuration and environment variables for the project.
Uses pydantic settings for validation.
"""

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    OPENROUTER_API_KEY: str
    OPENROUTER_URL: str = "https://openrouter.ai/api/v1"
    EMBEDDING_MODEL: str = "sentence-transformers/all-mpnet-base-v2"
    LLM_MODEL: str = "google/palm-2-chat-bison"
    
    
    # For vector base
    SIMILARITY_THRESHOLD: float = 0.5 # Adjust as needed
    
    # for chat history 
    MAX_HISTORY_LENGTH: int = 10  # Keep last 10 exchanges
    MAX_HISTORY_TOKENS: int = 3000  # Truncate if over
    
    class Config:
        env_file = ".env"

settings = Settings()