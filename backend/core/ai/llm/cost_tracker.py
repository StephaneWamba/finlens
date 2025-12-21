"""
Cost tracking for LLM usage
"""

from typing import Dict, Optional, Any
from datetime import date
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


# Pricing per 1M tokens (as of 2024)
# Format: {provider: {model: {"input": price_per_1M, "output": price_per_1M}}}
MODEL_PRICING = {
    "openai": {
        "gpt-4o": {"input": 2.50, "output": 10.00},  # $2.50/$10.00 per 1M tokens
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},  # $0.15/$0.60 per 1M tokens
        "text-embedding-3-small": {"input": 0.02, "output": 0.0},  # $0.02 per 1M tokens
    },
    "anthropic": {
        "claude-3-5-sonnet-20241022": {"input": 3.00, "output": 15.00},  # $3.00/$15.00 per 1M tokens
    }
}


class CostTracker:
    """Tracks costs for LLM usage"""
    
    def __init__(self):
        self.daily_costs: Dict[date, float] = defaultdict(float)
        self.task_costs: Dict[str, float] = defaultdict(float)
        self.model_costs: Dict[str, float] = defaultdict(float)
        self.provider_costs: Dict[str, float] = defaultdict(float)
        self.total_cost: float = 0.0
    
    def calculate_cost(
        self,
        prompt_tokens: int,
        completion_tokens: int,
        model: str,
        provider: str = "openai"
    ) -> float:
        """
        Calculate cost for a request
        
        Args:
            prompt_tokens: Number of tokens in prompt
            completion_tokens: Number of tokens in completion
            model: Model name
            provider: Provider name (openai, anthropic)
            
        Returns:
            Cost in USD
        """
        pricing = MODEL_PRICING.get(provider, {}).get(model)
        
        if not pricing:
            logger.warning(f"No pricing found for {provider}/{model}, returning 0.0")
            return 0.0
        
        input_cost = (prompt_tokens / 1_000_000) * pricing["input"]
        output_cost = (completion_tokens / 1_000_000) * pricing["output"]
        
        total_cost = input_cost + output_cost
        return total_cost
    
    def record_cost(
        self,
        cost: float,
        task: Optional[str] = None,
        model: Optional[str] = None,
        provider: Optional[str] = None
    ) -> None:
        """
        Record a cost
        
        Args:
            cost: Cost in USD
            task: Task name (optional)
            model: Model name (optional)
            provider: Provider name (optional)
        """
        self.total_cost += cost
        today = date.today()
        self.daily_costs[today] += cost
        
        if task:
            self.task_costs[task] += cost
        if model:
            self.model_costs[model] += cost
        if provider:
            self.provider_costs[provider] += cost
    
    def get_daily_cost(self, target_date: Optional[date] = None) -> float:
        """
        Get cost for a specific date (default: today)
        
        Args:
            target_date: Date to get cost for (default: today)
            
        Returns:
            Cost in USD
        """
        if target_date is None:
            target_date = date.today()
        return self.daily_costs.get(target_date, 0.0)
    
    def get_task_cost(self, task: str) -> float:
        """
        Get total cost for a task
        
        Args:
            task: Task name
            
        Returns:
            Cost in USD
        """
        return self.task_costs.get(task, 0.0)
    
    def get_summary(self) -> Dict[str, Any]:
        """
        Get cost summary
        
        Returns:
            Dictionary with cost breakdown
        """
        return {
            "total_cost": self.total_cost,
            "today_cost": self.get_daily_cost(),
            "by_task": dict(self.task_costs),
            "by_model": dict(self.model_costs),
            "by_provider": dict(self.provider_costs),
            "daily_breakdown": {str(d): c for d, c in self.daily_costs.items()}
        }
    
    def reset(self) -> None:
        """Reset all cost tracking"""
        self.daily_costs.clear()
        self.task_costs.clear()
        self.model_costs.clear()
        self.provider_costs.clear()
        self.total_cost = 0.0


# Global cost tracker instance
cost_tracker = CostTracker()

