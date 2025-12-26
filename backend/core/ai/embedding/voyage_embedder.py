"""
Voyage AI embedding generation
"""

from typing import List, Optional
import voyageai
from backend.config.settings import settings
import logging

logger = logging.getLogger(__name__)


class VoyageEmbedder:
    """Generates embeddings using Voyage AI's API."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.VOYAGE_API_KEY
        if not self.api_key:
            raise ValueError(
                "Voyage API key is required. Set VOYAGE_API_KEY in environment or settings.")

        self.model = settings.VOYAGE_EMBEDDING_MODEL
        self.dimensions = 2048  # Voyage models (voyage-large-2, voyage-finance-2) produce 2048-dimensional embeddings

        # Initialize Voyage AI client
        self.client = voyageai.Client(api_key=self.api_key)

    def embed_text(self, text: str, input_type: str = "document") -> List[float]:
        """
        Generate embedding for a single text.

        Args:
            text: Text to embed
            input_type: "document" for documents/chunks, "query" for search queries

        Returns:
            Embedding vector
        """
        try:
            result = self.client.embed(
                [text],
                model=self.model,
                input_type=input_type
            )
            return result.embeddings[0]
        except Exception as e:
            logger.error(f"Error generating Voyage embedding: {e}")
            raise ValueError(f"Error generating embedding: {e}")

    def embed_query(self, query: str) -> List[float]:
        """
        Generate embedding for a search query (optimized for retrieval).

        Args:
            query: Search query text

        Returns:
            Embedding vector optimized for query-document matching
        """
        return self.embed_text(query, input_type="query")

    def embed_batch(self, texts: List[str], input_type: str = "document") -> List[List[float]]:
        """
        Generate embeddings for a batch of texts.

        Args:
            texts: List of texts to embed
            input_type: "document" for documents/chunks, "query" for search queries

        Returns:
            List of embedding vectors
        """
        if not texts:
            return []

        # Validate and clean all texts - ensure they are non-empty strings
        validated_texts = []
        for text in texts:
            if not isinstance(text, str):
                raise ValueError(
                    f"Invalid input type: expected str, got {type(text).__name__}")
            cleaned = text.strip()
            if not cleaned:
                raise ValueError(
                    "Empty text string in batch - all texts must be non-empty")
            validated_texts.append(cleaned)

        try:
            result = self.client.embed(
                validated_texts,
                model=self.model,
                input_type=input_type
            )
            return result.embeddings
        except Exception as e:
            logger.error(f"Error generating batch Voyage embeddings: {e}")
            raise ValueError(f"Error generating batch embeddings: {e}")
