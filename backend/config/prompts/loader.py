"""
YAML prompt loader utility
"""

from pathlib import Path
from typing import Dict, Any, Optional
import yaml
import logging

logger = logging.getLogger(__name__)


class PromptLoader:
    """Loads and manages YAML prompts"""
    
    def __init__(self, prompts_dir: Optional[Path] = None):
        """
        Initialize prompt loader
        
        Args:
            prompts_dir: Directory containing YAML prompt files
                        (default: backend/config/prompts)
        """
        if prompts_dir is None:
            # Get prompts directory relative to this file
            prompts_dir = Path(__file__).parent
        
        self.prompts_dir = Path(prompts_dir)
        self._prompts_cache: Dict[str, Dict[str, Any]] = {}
    
    def load_prompt(self, prompt_name: str) -> Dict[str, Any]:
        """
        Load a prompt from YAML file
        
        Args:
            prompt_name: Name of prompt file (without .yaml extension)
            
        Returns:
            Dictionary with prompt data
            
        Raises:
            FileNotFoundError: If prompt file doesn't exist
            yaml.YAMLError: If YAML is invalid
        """
        # Check cache first
        if prompt_name in self._prompts_cache:
            return self._prompts_cache[prompt_name]
        
        # Load from file
        prompt_file = self.prompts_dir / f"{prompt_name}.yaml"
        
        if not prompt_file.exists():
            raise FileNotFoundError(f"Prompt file not found: {prompt_file}")
        
        try:
            with open(prompt_file, 'r', encoding='utf-8') as f:
                prompt_data = yaml.safe_load(f)
            
            if not prompt_data:
                raise ValueError(f"Prompt file is empty: {prompt_file}")
            
            # Cache it
            self._prompts_cache[prompt_name] = prompt_data
            
            logger.debug(f"Loaded prompt: {prompt_name}")
            return prompt_data
            
        except yaml.YAMLError as e:
            logger.error(f"Error parsing YAML in {prompt_file}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error loading prompt {prompt_name}: {e}")
            raise
    
    def get_system_prompt(self, prompt_name: str) -> str:
        """
        Get system prompt from YAML file
        
        Args:
            prompt_name: Name of prompt file
            
        Returns:
            System prompt string
        """
        prompt_data = self.load_prompt(prompt_name)
        return prompt_data.get("system_prompt", "")
    
    def get_user_prompt_template(self, prompt_name: str) -> str:
        """
        Get user prompt template from YAML file
        
        Args:
            prompt_name: Name of prompt file
            
        Returns:
            User prompt template string
        """
        prompt_data = self.load_prompt(prompt_name)
        return prompt_data.get("user_prompt", "")
    
    def get_metadata(self, prompt_name: str) -> Dict[str, Any]:
        """
        Get metadata from YAML file
        
        Args:
            prompt_name: Name of prompt file
            
        Returns:
            Metadata dictionary
        """
        prompt_data = self.load_prompt(prompt_name)
        return prompt_data.get("metadata", {})
    
    def format_prompt(self, prompt_name: str, **kwargs) -> str:
        """
        Load and format a prompt template with variables
        
        Args:
            prompt_name: Name of prompt file
            **kwargs: Variables to substitute in template
            
        Returns:
            Formatted prompt string
        """
        template = self.get_user_prompt_template(prompt_name)
        try:
            return template.format(**kwargs)
        except KeyError as e:
            logger.error(f"Missing variable in prompt {prompt_name}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error formatting prompt {prompt_name}: {e}")
            raise
    
    def clear_cache(self) -> None:
        """Clear the prompts cache"""
        self._prompts_cache.clear()
        logger.debug("Prompt cache cleared")


# Global prompt loader instance
prompt_loader = PromptLoader()

