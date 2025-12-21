"""
Agent 2: Analysis & Validation Agent - Subgraph definition
"""

from langgraph.graph import StateGraph, END

from backend.core.ai.agent.state import AgentState
from backend.core.ai.agent.agent2_analysis.nodes import (
    analysis_node,
    validation_node
)


def create_agent2_subgraph() -> StateGraph:
    """Create Agent 2 subgraph for analysis and validation."""
    workflow = StateGraph(AgentState)

    workflow.add_node("analysis", analysis_node)
    workflow.add_node("validation", validation_node)

    workflow.set_entry_point("analysis")
    workflow.add_edge("analysis", "validation")
    workflow.add_edge("validation", END)

    return workflow.compile()
