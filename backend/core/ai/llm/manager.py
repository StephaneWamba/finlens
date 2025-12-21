"""LLM Manager - Unified interface for language model operations."""

from typing import Optional, Dict, Any, TypeVar, Type
import logging
from pydantic import BaseModel
import instructor

from backend.core.ai.llm.providers.base import BaseLLMProvider, LLMResponse
from backend.core.ai.llm.providers.openai_provider import OpenAIProvider
from backend.core.ai.llm.model_selector import ModelSelector
from backend.core.ai.llm.token_tracker import TokenTracker
from backend.core.ai.llm.cost_tracker import cost_tracker

logger = logging.getLogger(__name__)

T = TypeVar('T', bound=BaseModel)


class LLMManager:
    """Central manager for LLM operations"""

    def __init__(self):
        self.providers: Dict[str, BaseLLMProvider] = {}
        self._initialize_providers()

    def _initialize_providers(self) -> None:
        """Initialize available providers"""
        try:
            self.providers["openai"] = OpenAIProvider()
            logger.info("OpenAI provider initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize OpenAI provider: {e}")

    def get_provider(self, provider_name: str) -> BaseLLMProvider:
        """Get a provider by name."""
        provider = self.providers.get(provider_name)
        if not provider:
            raise ValueError(
                f"Provider '{provider_name}' not found. Available: {list(self.providers.keys())}")
        return provider

    def generate(
        self,
        prompt: str,
        task: Optional[str] = None,
        model: Optional[str] = None,
        provider: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        response_format: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> LLMResponse:
        """Generate a response using the appropriate model."""
        # Select model
        if model is None:
            if task is None:
                raise ValueError("Either 'task' or 'model' must be provided")
            model = ModelSelector.get_model_for_task(task)
            logger.debug(f"Selected model {model} for task '{task}'")

        # Select provider
        if provider is None:
            provider = ModelSelector.get_provider_for_model(model)

        # Get provider and generate
        llm_provider = self.get_provider(provider)

        # Record cost with task if provided
        response = llm_provider.generate(
            prompt=prompt,
            model=model,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
            **kwargs
        )

        # Record task cost if task provided
        if task and response.cost:
            cost_tracker.record_cost(
                cost=response.cost,
                task=task,
                model=model,
                provider=provider
            )

        return response

    def count_tokens(self, text: str, model: str) -> int:
        """Count tokens in text."""
        return TokenTracker.count_tokens(text, model)

    def get_cost_summary(self) -> Dict[str, Any]:
        """Get cost tracking summary."""
        return cost_tracker.get_summary()

    def list_available_providers(self) -> list[str]:
        """List available providers."""
        return list(self.providers.keys())

    def list_available_models(self, provider: Optional[str] = None) -> list[str]:
        """List available models."""
        if provider:
            llm_provider = self.get_provider(provider)
            return llm_provider.list_models()
        else:
            models = []
            for prov in self.providers.values():
                models.extend(prov.list_models())
            return list(set(models))

    def generate_structured(
        self,
        prompt: str,
        response_model: Type[T],
        task: Optional[str] = None,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> T:
        """Generate structured response using instructor - returns Pydantic model directly."""
        # Get OpenAI client from provider
        try:
            provider = self.get_provider("openai")
            if not hasattr(provider, 'client'):
                raise ValueError(
                    "OpenAI provider must have 'client' attribute")

            # Wrap with instructor
            instructor_client = instructor.from_openai(provider.client)

            # Select model
            if model is None:
                if task is None:
                    raise ValueError(
                        "Either 'task' or 'model' must be provided")
                model = ModelSelector.get_model_for_task(task)
                logger.debug(f"Selected model {model} for task '{task}'")

            # Prepare messages
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            # Generate with instructor - returns Pydantic model directly
            result = instructor_client.chat.completions.create(
                model=model,
                messages=messages,
                response_model=response_model,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )

            # Log structured response generation
            if hasattr(result, 'model_dump'):
                result.model_dump()  # Validate it can be dumped
                logger.debug(
                    f"Generated structured response with {response_model.__name__}")

            return result

        except Exception as e:
            logger.error(f"Error in generate_structured: {e}")
            raise


# Global LLM manager instance
llm_manager = LLMManager()
