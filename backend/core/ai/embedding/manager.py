"""Embedding Manager - Handles vector embedding generation for queries and text (not document chunks - those are handled by Vast.ai server)."""

from typing import List, Optional, Union
from backend.core.ai.embedding.openai_embedder import OpenAIEmbedder
from backend.core.ai.embedding.voyage_embedder import VoyageEmbedder
from backend.config.settings import settings
from backend.core.utils.cache import SimpleCache
import logging
import threading

logger = logging.getLogger(__name__)

# Global embedding cache (1 hour TTL)
embedding_cache = SimpleCache(default_ttl_seconds=3600)

# Singleton instance for EmbeddingManager
_embedding_manager_instance: Optional['EmbeddingManager'] = None
_embedding_manager_lock = threading.Lock()


class EmbeddingManager:
    """Manages embedding generation for queries and text (document chunks are handled by Vast.ai server)."""

    def __init__(self, embedder: Optional[Union[OpenAIEmbedder, VoyageEmbedder]] = None):
        if embedder is None:
            # Select embedder based on settings
            if settings.EMBEDDING_PROVIDER.lower() == "voyage":
                try:
                    self.embedder = VoyageEmbedder()
                    # Use DEBUG level - initialization is not critical info
                    logger.debug(
                        f"Using Voyage AI embedder with model: {settings.VOYAGE_EMBEDDING_MODEL}")
                except Exception as e:
                    logger.warning(
                        f"Failed to initialize Voyage embedder: {e}. Falling back to OpenAI.")
                    self.embedder = OpenAIEmbedder()
            else:
                self.embedder = OpenAIEmbedder()
                # Use DEBUG level - initialization is not critical info
                logger.debug(
                    f"Using OpenAI embedder with model: {settings.EMBEDDING_MODEL}")
        else:
            self.embedder = embedder

    def embed_text(self, text: str) -> List[float]:
        """Generate embedding for a single text (e.g., conversation summaries, not document chunks)."""
        return self.embedder.embed_text(text)

    def embed_query(self, query: str) -> List[float]:
        """Generate embedding for a search query (optimized for retrieval)."""
        # Check cache first (include provider name in key for safety)
        provider_name = self.embedder.__class__.__name__
        cache_key = f"embedding:query:{provider_name}:{query}"

        cached = embedding_cache.get(cache_key)
        if cached is not None:
            logger.debug(f"Embedding cache hit for query: {query[:50]}...")
            return cached

        # Generate embedding
        if isinstance(self.embedder, VoyageEmbedder):
            embedding = self.embedder.embed_query(query)
        else:
            # OpenAI doesn't have query-specific embeddings, use standard
            embedding = self.embedder.embed_text(query)

        # Cache result
        embedding_cache.set(cache_key, embedding)
        logger.debug(f"Embedding cached for query: {query[:50]}...")

        return embedding

    def get_embedding_dimensions(self) -> int:
        """Get the embedding dimensions for the current embedder."""
        if isinstance(self.embedder, VoyageEmbedder):
            return 2048  # Voyage models (voyage-large-2, voyage-finance-2) produce 2048 dimensions
        else:
            return settings.EMBEDDING_DIMENSIONS


def get_embedding_manager() -> EmbeddingManager:
    """Get singleton EmbeddingManager instance."""
    global _embedding_manager_instance
    if _embedding_manager_instance is None:
        with _embedding_manager_lock:
            if _embedding_manager_instance is None:
                _embedding_manager_instance = EmbeddingManager()
                logger.debug("EmbeddingManager singleton instance created")
    return _embedding_manager_instance
