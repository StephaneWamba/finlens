"""
Agent 1: Query & Retrieval Agent - Subgraph definition
"""

from langgraph.graph import StateGraph, END
from typing import Literal

from backend.core.ai.agent.state import AgentState
from backend.core.ai.agent.agent1_retrieval.nodes import (
    memory_check_node,
    query_processing_node,
    memory_check_and_query_processing_node,
    retrieval_node,
    validation_node,
    refinement_node
)
from backend.core.utils.async_logger import get_async_logger

# Use async logger for non-blocking I/O
logger = get_async_logger(__name__)


def should_continue_retrieval(state: AgentState) -> Literal["validate", "refine", "end"]:
    """
    Conditional edge: Continue retrieval loop or proceed.

    Returns:
        "refine" if insufficient and attempts < 3
        "end" if max attempts reached
        "validate" otherwise (shouldn't happen, but safety)
    """
    sufficient = state.get("retrieval_sufficient", False)
    attempts = state.get("retrieval_attempts", 0)

    if sufficient:
        return "end"
    elif attempts >= 3:
        logger.warning("Max retrieval attempts reached, proceeding anyway")
        return "end"
    else:
        return "refine"


def create_agent1_subgraph() -> StateGraph:
    """
    Create Agent 1 subgraph with iterative retrieval loop.

    Flow:
    1. Check memory + Process query (parallel)
    2. Retrieve
    3. Validate
    4. If insufficient -> Refine -> Retrieve again (loop)
    5. If sufficient -> End
    """
    workflow = StateGraph(AgentState)

    # Add nodes
    # Use combined node for parallel execution (optimization)
    workflow.add_node("memory_and_query",
                      memory_check_and_query_processing_node)
    workflow.add_node("memory_check", memory_check_node)
    workflow.add_node("query_processing", query_processing_node)
    workflow.add_node("retrieval", retrieval_node)
    workflow.add_node("validation", validation_node)
    workflow.add_node("refinement", refinement_node)

    # Set entry point to combined node
    workflow.set_entry_point("memory_and_query")

    # Flow: combined node -> retrieval -> validation
    workflow.add_edge("memory_and_query", "retrieval")
    workflow.add_edge("retrieval", "validation")

    # Conditional: validation -> refine (loop) or end
    workflow.add_conditional_edges(
        "validation",
        should_continue_retrieval,
        {
            "refine": "refinement",
            "end": END
        }
    )

    # Refinement loops back to retrieval
    workflow.add_edge("refinement", "retrieval")

    # Compile graph (recursion_limit set via config in orchestrator)
    return workflow.compile()
