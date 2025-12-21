"""
Agent 3: Generation & Quality Agent - Subgraph definition
"""

from langgraph.graph import StateGraph, END
from typing import Literal

from backend.core.ai.agent.state import AgentState
from backend.core.ai.agent.agent3_generation.nodes import (
    text_explanation_node,
    synthesis_node,
    quality_check_node,
    self_heal_node,
    memory_update_node
)


def should_continue_healing(state: AgentState) -> Literal["heal", "end"]:
    """
    Conditional edge: Continue self-healing or proceed.

    Returns:
        "heal" if invalid and attempts < 2
        "end" otherwise
    """
    valid = state.get("response_valid", True)
    attempts = state.get("self_heal_attempts", 0)

    if valid:
        return "end"
    elif attempts >= 2:
        return "end"  # Max attempts reached
    else:
        return "heal"


def create_agent3_subgraph() -> StateGraph:
    """Create Agent 3 subgraph with quality loop."""
    workflow = StateGraph(AgentState)

    workflow.add_node("text_explanation", text_explanation_node)
    workflow.add_node("synthesis", synthesis_node)
    workflow.add_node("quality_check", quality_check_node)
    workflow.add_node("self_heal", self_heal_node)
    workflow.add_node("memory_update", memory_update_node)

    workflow.set_entry_point("text_explanation")
    workflow.add_edge("text_explanation", "synthesis")
    workflow.add_edge("synthesis", "quality_check")

    # Conditional: quality -> heal (loop) or memory_update -> end
    workflow.add_conditional_edges(
        "quality_check",
        should_continue_healing,
        {
            "heal": "self_heal",
            "end": "memory_update"
        }
    )

    # Self-heal loops back to synthesis
    workflow.add_edge("self_heal", "synthesis")

    # Memory update -> end
    workflow.add_edge("memory_update", END)

    # Compile graph (recursion_limit set via config in orchestrator)
    return workflow.compile()
