"""
OpenAI LLM Provider implementation
"""

from typing import Optional, Dict, Any
from openai import OpenAI
import logging

from backend.core.ai.llm.providers.base import BaseLLMProvider, LLMResponse
from backend.core.ai.llm.token_tracker import TokenTracker
from backend.core.ai.llm.cost_tracker import cost_tracker
from backend.config.settings import settings

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseLLMProvider):
    """OpenAI LLM provider"""

    def __init__(self, api_key: Optional[str] = None):
        super().__init__(api_key or settings.OPENAI_API_KEY)
        if not self.api_key:
            raise ValueError(
                "OpenAI API key is required. Set OPENAI_API_KEY in environment variables.")

        self.client = OpenAI(api_key=self.api_key)
        self.provider_name = "openai"

    def generate(
        self,
        prompt: str,
        model: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        response_format: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> LLMResponse:
        """
        Generate a response using OpenAI API

        Args:
            prompt: User prompt
            model: Model name (e.g., gpt-4o, gpt-4o-mini)
            system_prompt: Optional system prompt
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens to generate
            response_format: Optional structured output format (JSON schema)
            **kwargs: Additional OpenAI API parameters

        Returns:
            LLMResponse with generated content and metadata
        """
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        messages.append({"role": "user", "content": prompt})

        # Prepare API parameters
        api_params = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            **kwargs
        }

        # Add structured output if provided
        if response_format:
            api_params["response_format"] = response_format

        try:
            response = self.client.chat.completions.create(**api_params)

            content = response.choices[0].message.content
            prompt_tokens = response.usage.prompt_tokens
            completion_tokens = response.usage.completion_tokens
            total_tokens = response.usage.total_tokens

            # Calculate cost
            cost = cost_tracker.calculate_cost(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                model=model,
                provider="openai"
            )

            # Record cost
            cost_tracker.record_cost(
                cost=cost,
                model=model,
                provider="openai"
            )

            return LLMResponse(
                content=content or "",
                model=model,
                provider="openai",
                tokens_used=total_tokens,
                cost=cost,
                metadata={
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "finish_reason": response.choices[0].finish_reason
                }
            )

        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise

    def count_tokens(self, text: str, model: str) -> int:
        """
        Count tokens using tiktoken

        Args:
            text: Text to count tokens for
            model: Model name

        Returns:
            Number of tokens
        """
        return TokenTracker.count_tokens(text, model)

    def calculate_cost(
        self,
        prompt_tokens: int,
        completion_tokens: int,
        model: str
    ) -> float:
        """
        Calculate cost for OpenAI request

        Args:
            prompt_tokens: Number of tokens in prompt
            completion_tokens: Number of tokens in completion
            model: Model name

        Returns:
            Cost in USD
        """
        return cost_tracker.calculate_cost(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            model=model,
            provider="openai"
        )

    def list_models(self) -> list[str]:
        """
        List available OpenAI models

        Returns:
            List of model names
        """
        return [
            "gpt-4o",
            "gpt-4o-mini",
            "text-embedding-3-small",
            "text-embedding-3-large"
        ]
