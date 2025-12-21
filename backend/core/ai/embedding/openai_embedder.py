"""
OpenAI embedding generation
"""

from typing import List, Optional
from openai import OpenAI
from backend.config.settings import settings


class OpenAIEmbedder:
    """Generates embeddings using OpenAI's API."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        if not self.api_key:
            raise ValueError("OpenAI API key is required. Set OPENAI_API_KEY in environment or settings.")
        
        self.model = settings.EMBEDDING_MODEL
        self.dimensions = settings.EMBEDDING_DIMENSIONS
        
        # Initialize OpenAI client
        self.client = OpenAI(api_key=self.api_key)
    
    def embed_text(self, text: str) -> List[float]:
        """
        Generate embedding for a single text.
        
        Args:
            text: Text to embed
            
        Returns:
            Embedding vector
        """
        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=text,
                dimensions=self.dimensions
            )
            return response.data[0].embedding
        except Exception as e:
            raise ValueError(f"Error generating embedding: {e}")
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for a batch of texts.
        
        Args:
            texts: List of texts to embed
            
        Returns:
            List of embedding vectors
        """
        if not texts:
            return []
        
        # Validate and clean all texts - ensure they are non-empty strings
        validated_texts = []
        for text in texts:
            if not isinstance(text, str):
                raise ValueError(f"Invalid input type: expected str, got {type(text).__name__}")
            cleaned = text.strip()
            if not cleaned:
                raise ValueError("Empty text string in batch - all texts must be non-empty")
            validated_texts.append(cleaned)
        
        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=validated_texts,
                dimensions=self.dimensions
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            raise ValueError(f"Error generating batch embeddings: {e}")

