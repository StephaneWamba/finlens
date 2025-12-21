"""
Application settings and configuration using Pydantic Settings
"""

from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from dotenv import load_dotenv

# Load .env file explicitly
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)


class Settings(BaseSettings):
    """Application settings"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    # OpenAI settings
    OPENAI_API_KEY: Optional[str] = Field(
        default=None,
        description="OpenAI API key"
    )

    # Embedding settings
    EMBEDDING_PROVIDER: str = Field(
        default="voyage",  # "openai" or "voyage"
        description="Embedding provider to use"
    )
    EMBEDDING_MODEL: str = Field(
        default="text-embedding-3-small",
        description="OpenAI embedding model"
    )
    EMBEDDING_DIMENSIONS: int = Field(
        default=2048,
        description="Embedding dimensions (2048 for voyage-large-2)"
    )

    # Voyage AI settings
    VOYAGE_API_KEY: Optional[str] = Field(
        default=None,
        description="Voyage AI API key"
    )
    VOYAGE_EMBEDDING_MODEL: str = Field(
        default="voyage-large-2",
        description="Voyage AI embedding model"
    )

    # Vector database settings (Qdrant)
    QDRANT_HOST: str = Field(
        default="localhost",
        description="Qdrant host"
    )
    QDRANT_PORT: int = Field(
        default=6333,
        description="Qdrant port"
    )
    QDRANT_API_KEY: Optional[str] = Field(
        default=None,
        description="Qdrant API key (for cloud)"
    )
    QDRANT_URL: Optional[str] = Field(
        default=None,
        description="Qdrant Cloud URL (for production)"
    )

    # Retrieval settings
    TOP_K_INITIAL: int = Field(
        default=30,
        description="Initial retrieval count"
    )
    TOP_K_FINAL: int = Field(
        default=8,
        description="Final chunks for context window"
    )
    HYBRID_SEARCH_ALPHA: float = Field(
        default=0.7,
        description="Hybrid search weight (0=semantic, 1=keyword)"
    )

    # Supabase settings
    SUPABASE_URL: Optional[str] = Field(
        default="http://localhost:54331",
        description="Supabase project URL (default: local development)"
    )
    SUPABASE_KEY: Optional[str] = Field(
        default=None,
        description="Supabase anon/service key (get from 'supabase status' after starting)"
    )
    SUPABASE_SECRET_KEY: Optional[str] = Field(
        default=None,
        description="Supabase secret key (replaces service_role key, for admin operations)"
    )
    SUPABASE_SERVICE_KEY: Optional[str] = Field(
        default=None,
        description="Supabase service role key (legacy, use SUPABASE_SECRET_KEY instead)"
    )

    # Vast.ai GPU server URL
    VAST_AI_SERVER_URL: Optional[str] = Field(
        default=None,
        description="Vast.ai GPU server URL for document processing (e.g., http://83.27.164.65:8080)"
    )
    VAST_AI_API_KEY: Optional[str] = Field(
        default=None,
        description="API key for authenticating with Vast.ai server (sent in X-API-Key header)"
    )

    # Stripe settings
    STRIPE_SECRET_KEY: Optional[str] = Field(
        default=None,
        description="Stripe secret key"
    )
    STRIPE_WEBHOOK_SECRET: Optional[str] = Field(
        default=None,
        description="Stripe webhook signing secret"
    )
    STRIPE_PRO_PRICE_ID: Optional[str] = Field(
        default=None,
        description="Stripe price ID for Pro tier subscription"
    )
    STRIPE_ENTERPRISE_PRICE_ID: Optional[str] = Field(
        default=None,
        description="Stripe price ID for Enterprise tier subscription"
    )

    # Performance settings
    BATCH_SIZE: int = Field(
        default=100,
        description="Batch size for embedding generation"
    )
    MAX_WORKERS: int = Field(
        default=4,
        description="Maximum worker threads"
    )

    # Document processing settings
    DOCUMENT_MAX_SIZE_MB: int = Field(
        default=100,
        description="Maximum document size in MB"
    )
    DOCUMENT_SUPPORTED_EXTENSIONS: list[str] = Field(
        default=[".pdf", ".png", ".jpg", ".jpeg"],
        description="Supported document file extensions (PDF and images only - Office files not supported)"
    )
    DOCUMENT_STORAGE_BUCKET: str = Field(
        default="user-documents",
        description="Supabase Storage bucket name for documents"
    )
    DOCUMENT_MAX_BATCH_SIZE: int = Field(
        default=10,
        description="Maximum number of files in a batch upload"
    )

    # Logging settings
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Logging level (DEBUG, INFO, WARNING, ERROR)"
    )

    # API settings
    DEBUG: bool = Field(
        default=False,
        description="Debug mode (shows detailed error messages)"
    )
    ENVIRONMENT: str = Field(
        default="development",
        description="Environment (development, staging, production)"
    )
    CORS_ORIGINS: str = Field(
        default="*",
        description="CORS allowed origin (single origin for production)"
    )
    LOG_FILE: Optional[Path] = Field(
        default=None,
        description="Log file path (optional)"
    )


# Global settings instance
settings = Settings()
