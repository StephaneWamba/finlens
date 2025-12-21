"""
Application constants
"""

# Companies
COMPANIES = [
    "apple",
    "microsoft",
    "amazon",
    "alphabet",
    "meta",
    "nvidia",
    "tesla"
]

# Note: COMPANIES list is kept for keyword search company name recognition
# but is no longer used for collection management (single collection now)


# Conversation memory collection
CONVERSATION_MEMORY_COLLECTION = "conversation_memory"

# LLM Models


class LLMModels:
    """LLM model names"""
    # OpenAI
    GPT_4O_MINI = "gpt-4o-mini"
    GPT_4O = "gpt-4o"

    # Anthropic
    CLAUDE_3_5_SONNET = "claude-3-5-sonnet-20241022"


# Task-based model mapping
TASK_MODELS = {
    "query_augmentation": LLMModels.GPT_4O_MINI,
    "query_decomposition": LLMModels.GPT_4O_MINI,
    "format_selection": LLMModels.GPT_4O_MINI,
    "data_extraction": LLMModels.GPT_4O,
    # Use GPT-4o for analysis (more powerful for structured extraction)
    "analysis": LLMModels.GPT_4O,
    "text_explanation": LLMModels.GPT_4O,
    "generation": LLMModels.GPT_4O,
    "response_synthesis": LLMModels.GPT_4O,
    "analytical_reasoning": LLMModels.CLAUDE_3_5_SONNET,
    "memory_compression": LLMModels.GPT_4O_MINI,
    "memory_summarization": LLMModels.GPT_4O_MINI,
    "quality_validation": LLMModels.GPT_4O,
}

# Retrieval constants
DEFAULT_TOP_K = 8
DEFAULT_TOP_K_MULTI_COMPANY_MULTIPLIER = 6
CONTENT_HASH_LENGTH = 200
CONTENT_PREVIEW_LENGTH = 500
