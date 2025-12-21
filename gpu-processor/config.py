"""Configuration management for Vast.ai GPU server."""
import os
from typing import Optional

# Supabase Configuration
SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY: Optional[str] = os.getenv("SUPABASE_SECRET_KEY")
DOCUMENT_STORAGE_BUCKET: str = os.getenv(
    "DOCUMENT_STORAGE_BUCKET", "user-documents")

# MinerU Configuration
MINERU_TIMEOUT: int = int(os.getenv("MINERU_TIMEOUT_SECONDS", "3600"))
MINERU_BACKEND: str = os.getenv("MINERU_BACKEND", "vlm-vllm-engine")

# Server Configuration
PORT: int = int(os.getenv("PORT", "8080"))
HOST: str = os.getenv("HOST", "0.0.0.0")
API_KEY: Optional[str] = os.getenv("API_KEY")

# Queue Configuration
REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
MAX_CONCURRENT_WORKERS: int = int(os.getenv("MAX_CONCURRENT_WORKERS", "2"))
WEBHOOK_URL: Optional[str] = os.getenv("WEBHOOK_URL")

# Indexing Configuration
VOYAGE_API_KEY: Optional[str] = os.getenv("VOYAGE_API_KEY")
VOYAGE_MODEL: str = os.getenv("VOYAGE_EMBEDDING_MODEL", "voyage-large-2")
QDRANT_URL: Optional[str] = os.getenv("QDRANT_URL")
QDRANT_API_KEY: Optional[str] = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME: str = "document_chunks"
