"""Main Graph Orchestrator - Coordinates the 3-agent workflow."""

from langgraph.graph import StateGraph, END
from typing import Literal

from backend.core.ai.agent.state import AgentState
from backend.core.ai.agent.agent1_retrieval.subgraph import create_agent1_subgraph
from backend.core.ai.agent.agent2_analysis.subgraph import create_agent2_subgraph
from backend.core.ai.agent.agent3_generation.subgraph import create_agent3_subgraph

from backend.core.utils.async_logger import get_async_logger

# Use async logger for non-blocking I/O
logger = get_async_logger(__name__)


def should_continue_after_agent1(state: AgentState) -> Literal["agent2", "end"]:
    """Route after Agent 1: always go to Agent 2 unless error."""
    if state.get("error"):
        logger.error(f"Workflow error after Agent 1: {state['error']}")
        return "end"
    return "agent2"


def should_continue_after_agent2(state: AgentState) -> Literal["agent3", "end"]:
    """Route after Agent 2: always go to Agent 3 unless error."""
    if state.get("error"):
        logger.error(f"Workflow error after Agent 2: {state['error']}")
        return "end"
    return "agent3"


def create_main_graph() -> StateGraph:
    """Create main orchestrator graph connecting all 3 agents."""
    workflow = StateGraph(AgentState)

    # Create subgraphs
    agent1_graph = create_agent1_subgraph()
    agent2_graph = create_agent2_subgraph()
    agent3_graph = create_agent3_subgraph()

    # Add subgraphs as nodes
    workflow.add_node("agent1", agent1_graph)
    workflow.add_node("agent2", agent2_graph)
    workflow.add_node("agent3", agent3_graph)

    # Set entry point
    workflow.set_entry_point("agent1")

    # Linear flow with error handling
    workflow.add_conditional_edges(
        "agent1",
        should_continue_after_agent1,
        {
            "agent2": "agent2",
            "end": END
        }
    )

    workflow.add_conditional_edges(
        "agent2",
        should_continue_after_agent2,
        {
            "agent3": "agent3",
            "end": END
        }
    )

    workflow.add_edge("agent3", END)

    # Compile workflow
    return workflow.compile()


def run_query(
    query: str,
    user_id: str,
    session_id: str,
    initial_messages: list = None
) -> AgentState:
    """Run the complete agent workflow for a user query."""
    logger.info(
        f"[AGENT WORKFLOW] Starting query processing for user={user_id}, session={session_id}")
    logger.info(f"[AGENT WORKFLOW] Query: {query}")

    # Initialize state
    initial_state: AgentState = {
        "messages": initial_messages or [],
        "current_query": query,
        "user_id": user_id,
        "session_id": session_id,
        # Query Decomposition
        "sub_queries": None,
        "is_decomposed": False,
        "sub_query_results": None,
        # Query Processing (Agent 1)
        "processed_query": None,
        "retrieval_sufficient": False,
        "retrieval_attempts": 0,
        "gaps": [],
        # Retrieval (Agent 1)
        "retrieved_context": [],
        # Analysis (Agent 2)
        "analysis_results": None,
        # Response (Agent 3)
        "response": None,
        "response_valid": False,
        "validation_errors": [],
        "self_heal_attempts": 0,
        # Memory
        "relevant_history": [],
        "conversation_summary": None,
        # Error Handling
        "error": None,
        "retry_count": 0
    }

    # Create and run graph
    logger.info("[AGENT WORKFLOW] Creating main graph...")
    graph = create_main_graph()

    logger.info("[AGENT WORKFLOW] Executing agent workflow...")
    # Use thread_id from session_id and set recursion limit
    config = {
        "configurable": {
            "thread_id": session_id
        },
        "recursion_limit": 15  # Prevent infinite loops
    }
    final_state = graph.invoke(initial_state, config=config)

    logger.info(
        f"[AGENT WORKFLOW] Workflow completed. Response generated: {final_state.get('response') is not None}")
    if final_state.get("error"):
        logger.error(
            f"[AGENT WORKFLOW] Error occurred: {final_state['error']}")

    return final_state
