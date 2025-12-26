"""
Agent State Schema - Type definitions for workflow state management.

Defines state structure for 3-agent workflow. AgentState TypedDict contains all state
fields. Pydantic models validate LLM responses before conversion to workflow state.
"""

from typing import TypedDict, Annotated, List, Optional, Dict, Any
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field


class SubQuery(BaseModel):
    """A decomposed sub-query"""
    sub_query: str  # The sub-query text
    # What it's asking for (e.g., "revenue_lookup", "comparison", "trend")
    intent: str
    companies: List[str]
    years: Optional[List[int]] = None
    year_range: Optional[List[int]] = None  # [start_year, end_year]
    metrics: List[str] = Field(default_factory=list)  # What metrics it needs
    priority: int = 1  # 1=high, 2=medium, 3=low
    # Augmented/refined query text for retrieval
    augmented_query: Optional[str] = None


class QueryDecompositionResponse(BaseModel):
    """LLM response for query decomposition"""
    needs_decomposition: bool
    sub_queries: List[SubQuery] = Field(default_factory=list)
    reasoning: str = ""


class ProcessedQuery(BaseModel):
    """Processed query with extracted entities"""
    query_text: str
    companies: List[str]
    years: Optional[List[int]] = None
    year_range: Optional[tuple[int, int]] = None
    query_type: str
    augmented_query: str  # Keywords only, no stopwords


class QueryProcessingResponse(BaseModel):
    """LLM response for query processing - will be converted to ProcessedQuery"""
    companies: List[str]
    years: Optional[List[int]] = None
    year_range: Optional[List[int]] = None  # Will be converted to tuple
    query_type: str
    augmented_query: str
    sufficient: Optional[bool] = None  # For validation
    gaps: Optional[List[str]] = None  # For validation


class ValidationResponse(BaseModel):
    """LLM response for retrieval validation"""
    sufficient: bool
    gaps: List[str]


class RefinementResponse(BaseModel):
    """LLM response for query refinement"""
    refined_query: str
    additional_keywords: List[str]


class RetrievedChunk(BaseModel):
    """Retrieved chunk from vector DB"""
    content: str
    score: float
    metadata: Dict[str, Any]
    # REMOVED: Old fields (company, year, page_idx) - all data comes from metadata dict
    # Clean implementation: no redundant top-level fields


class AnalysisResult(BaseModel):
    """Analysis result from Agent 2 - simplified to natural language"""
    metric: Optional[str] = Field(
        default=None,
        description="The primary financial metric being analyzed (e.g., 'revenue', 'net income', 'iPhone revenue')"
    )
    analysis: str = Field(
        default="",
        description="Complete analysis in natural language. Include: specific values found, calculations performed, "
                    "and key insights. Be concise yet precise and complete. Format: 'I found [company]'s [metric] "
                    "in [year]: [value]. [Calculations if any]. [Key insights].'"
    )


class AnalysisValidationResponse(BaseModel):
    """LLM response for analysis validation"""
    valid: bool
    errors: List[str]
    warnings: List[str]


class AnswerResponse(BaseModel):
    """Final answer response"""
    text: str  # Markdown with LaTeX and [CHART:N] placeholders (NO sources)
    charts: List[Dict[str, Any]] = Field(
        default=[], description="Chart.js configurations")  # List of chart dicts
    sources: List[Dict[str, Any]] = Field(
        default=[], description="Source citations (company, year, page)")
    metadata: Dict[str, Any] = {}


class AgentState(TypedDict):
    """Main state for LangGraph workflow"""

    # User Input
    messages: Annotated[List[dict], add_messages]
    current_query: str
    user_id: str
    session_id: str

    # Query Decomposition
    sub_queries: Optional[List[SubQuery]]
    is_decomposed: bool
    # intent -> chunks
    sub_query_results: Optional[Dict[str, List[RetrievedChunk]]]

    # Query Processing (Agent 1)
    processed_query: Optional[ProcessedQuery]
    retrieval_sufficient: bool
    retrieval_attempts: int  # Max 3
    gaps: List[str]  # Gaps identified during validation

    # Retrieval (Agent 1)
    retrieved_context: List[RetrievedChunk]

    # Analysis (Agent 2)
    analysis_results: Optional[AnalysisResult]

    # Response (Agent 3)
    response: Optional[AnswerResponse]
    response_valid: bool
    validation_errors: List[str]
    self_heal_attempts: int  # Max 2

    # Memory
    relevant_history: List[dict]  # From memory system
    conversation_summary: Optional[str]

    # Error Handling
    error: Optional[str]
    retry_count: int
