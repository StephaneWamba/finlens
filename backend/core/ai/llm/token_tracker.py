"""
Token tracking using tiktoken
"""

import tiktoken
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class TokenTracker:
    """Tracks tokens using tiktoken"""
    
    # Cache encodings for performance
    _encoding_cache: Dict[str, tiktoken.Encoding] = {}
    
    @classmethod
    def get_encoding(cls, model: str) -> tiktoken.Encoding:
        """
        Get tiktoken encoding for a model (cached)
        
        Args:
            model: Model name
            
        Returns:
            tiktoken.Encoding instance
        """
        if model not in cls._encoding_cache:
            try:
                cls._encoding_cache[model] = tiktoken.encoding_for_model(model)
            except KeyError:
                # Fallback to cl100k_base for unknown models
                logger.warning(f"Unknown model {model}, using cl100k_base encoding")
                cls._encoding_cache[model] = tiktoken.get_encoding("cl100k_base")
        
        return cls._encoding_cache[model]
    
    @classmethod
    def count_tokens(cls, text: str, model: str) -> int:
        """
        Count tokens in text for a specific model
        
        Args:
            text: Text to count tokens for
            model: Model name
            
        Returns:
            Number of tokens
        """
        encoding = cls.get_encoding(model)
        return len(encoding.encode(text))
    
    @classmethod
    def count_tokens_batch(cls, texts: list[str], model: str) -> int:
        """
        Count total tokens across multiple texts
        
        Args:
            texts: List of texts
            model: Model name
            
        Returns:
            Total number of tokens
        """
        encoding = cls.get_encoding(model)
        total = 0
        for text in texts:
            total += len(encoding.encode(text))
        return total

