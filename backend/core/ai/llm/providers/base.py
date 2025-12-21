"""
Base LLM Provider interface
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class LLMResponse(BaseModel):
    """Standardized LLM response"""
    content: str
    model: str
    provider: str
    tokens_used: Optional[int] = None
    cost: Optional[float] = None
    metadata: Dict[str, Any] = {}


class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.provider_name = self.__class__.__name__.replace(
            "Provider", "").lower()

    @abstractmethod
    def generate(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> LLMResponse:
        """
        Generate a response from the LLM

        Args:
            prompt: User prompt
            model: Model name to use
            system_prompt: Optional system prompt
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens to generate
            **kwargs: Additional provider-specific parameters

        Returns:
            LLMResponse with generated content and metadata
        """

    @abstractmethod
    def count_tokens(self, text: str, model: str) -> int:
        """
        Count tokens in text for a specific model

        Args:
            text: Text to count tokens for
            model: Model name

        Returns:
            Number of tokens
        """

    @abstractmethod
    def calculate_cost(
        self,
        prompt_tokens: int,
        completion_tokens: int,
        model: str
    ) -> float:
        """
        Calculate cost for a request

        Args:
            prompt_tokens: Number of tokens in prompt
            completion_tokens: Number of tokens in completion
            model: Model name

        Returns:
            Cost in USD
        """

    @abstractmethod
    def list_models(self) -> List[str]:
        """
        List available models for this provider

        Returns:
            List of model names
        """
