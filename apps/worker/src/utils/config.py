import os
from typing import Optional
from supabase import create_client, Client

class Config:
    """Application configuration."""
    
    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    # Spotify
    SPOTIFY_CLIENT_ID: str = os.getenv("SPOTIFY_CLIENT_ID", "")
    SPOTIFY_CLIENT_SECRET: str = os.getenv("SPOTIFY_CLIENT_SECRET", "")
    
    # CORS
    ALLOWED_ORIGINS: list = os.getenv("ALLOWED_ORIGINS", "*").split(",")
    
    # Analysis
    EMBEDDING_DIM: int = 64
    PREVIEW_MIN_DURATION: float = 15.0
    PREVIEW_MAX_DURATION: float = 35.0
    
    # Temporal
    TEMPORAL_DECAY_HALF_LIFE_DAYS: float = 180.0
    OUTLIER_CONTAMINATION: float = 0.05
    
    @classmethod
    def get_supabase_client(cls, use_service_role: bool = False) -> Client:
        """Get Supabase client."""
        key = cls.SUPABASE_SERVICE_ROLE_KEY if use_service_role else cls.SUPABASE_ANON_KEY
        return create_client(cls.SUPABASE_URL, key)
