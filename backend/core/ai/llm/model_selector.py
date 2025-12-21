"""
Task-based model selection
"""

from backend.config.constants import TASK_MODELS, LLMModels
import logging

logger = logging.getLogger(__name__)


class ModelSelector:
    """Selects appropriate model based on task"""
    
    @staticmethod
    def get_model_for_task(task: str) -> str:
        """
        Get the recommended model for a task
        
        Args:
            task: Task name (query_augmentation, data_extraction, etc.)
            
        Returns:
            Model name
        """
        model = TASK_MODELS.get(task)
        
        if not model:
            logger.warning(f"No model configured for task '{task}', defaulting to GPT-4o-mini")
            return LLMModels.GPT_4O_MINI
        
        return model
    
    @staticmethod
    def get_provider_for_model(model: str) -> str:
        """
        Get provider name for a model
        
        Args:
            model: Model name
            
        Returns:
            Provider name (openai, anthropic)
        """
        if model.startswith("gpt-") or model.startswith("text-embedding-"):
            return "openai"
        elif model.startswith("claude-"):
            return "anthropic"
        else:
            logger.warning(f"Unknown model {model}, defaulting to openai")
            return "openai"
    
    @staticmethod
    def is_embedding_model(model: str) -> bool:
        """
        Check if model is an embedding model
        
        Args:
            model: Model name
            
        Returns:
            True if embedding model
        """
        return "embedding" in model.lower()
    
    @staticmethod
    def list_available_tasks() -> list[str]:
        """
        List all available tasks
        
        Returns:
            List of task names
        """
        return list(TASK_MODELS.keys())

