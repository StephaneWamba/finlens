"""
Agent 3: Generation & Quality Agent - Node implementations
"""

from typing import Dict, Any, List
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.core.ai.agent.state import AgentState, AnswerResponse
from backend.core.ai.llm import llm_manager
from backend.config.prompts import prompt_loader
from backend.core.utils.async_logger import get_async_logger

# Use async logger for non-blocking I/O
logger = get_async_logger(__name__)

# REMOVED: COMPANY_DISPLAY_NAMES - use actual company names from metadata


def _extract_sources(retrieved_context: List) -> List[Dict[str, Any]]:
    """Extract unique sources from retrieved context with rich metadata."""
    sources = []
    seen_sources = set()
    
    for chunk in retrieved_context:
        # Extract all fields from metadata (clean implementation - no fallbacks)
        company = chunk.metadata.get('company_name') or chunk.metadata.get('company') or ""
        year = chunk.metadata.get('fiscal_year') or 0  # Use primary field only
        document_type = chunk.metadata.get('document_type')
        fiscal_quarter = chunk.metadata.get('fiscal_quarter')
        ticker = chunk.metadata.get('company_ticker')
        
        # Create unique source key
        source_key = (
            company.lower() if company else "",
            year,
            document_type or "",
            fiscal_quarter or 0,
            chunk.metadata.get('page_idx', 0)  # Clean: from metadata
        )
        
        if source_key not in seen_sources:
            seen_sources.add(source_key)
            
            # Format document type for display
            doc_type_display = document_type or "Document"
            if fiscal_quarter and document_type in ["10-Q", "10Q"]:
                doc_type_display = f"{document_type} Q{fiscal_quarter}"
            
            sources.append({
                "company": company or "Unknown",
                "ticker": ticker,
                "year": year,
                "fiscal_quarter": fiscal_quarter,
                "document_type": document_type,
                "document_display": doc_type_display,
                "page": chunk.metadata.get('page_idx', 0),  # Clean: from metadata
                "sector": chunk.metadata.get('company_sector'),
            })
    
    return sources


def _format_sources_text(sources: List[Dict[str, Any]]) -> str:
    """Format sources as text for prompt with rich metadata."""
    if not sources:
        return ""
    
    formatted = []
    for s in sources:
        # Format: "Apple Inc. (AAPL) 2024 10-K Q4, Page 45"
        parts = []
        if s.get('company'):
            parts.append(s['company'])
        if s.get('ticker'):
            parts.append(f"({s['ticker']})")
        if s.get('year'):
            parts.append(str(s['year']))
        if s.get('document_display'):
            parts.append(s['document_display'])
        if s.get('page') is not None:
            parts.append(f"Page {s['page']}")
        
        formatted.append(" ".join(parts))
    
    return "\n".join([f"- {s}" for s in formatted])


def _generate_single_chart(chart_index: int, query: str, analyzed_data: str, prompt_data: Dict) -> Dict[str, Any]:
    """Generate a single Chart.js configuration."""
    chart_prompt_template = prompt_data.get("chart_generation_prompt")
    if not chart_prompt_template:
        chart_prompt_template = """Generate Chart.js configuration JSON for the following data visualization request.

Query: {query}
Analyzed Data: {analyzed_data}

Generate Chart.js configuration as a JSON object with:
- "type": "line" | "bar" | "pie" | "doughnut"
- "data": {{"labels": [...], "datasets": [...]}}
- "options": {{...}} (optional)

Return ONLY the JSON object, no markdown, no explanations, no backticks."""

    chart_prompt = chart_prompt_template.format(
        query=query,
        analyzed_data=analyzed_data if analyzed_data else "No data available",
        num_charts=1
    )

    try:
        chart_response = llm_manager.generate(
            prompt=chart_prompt,
            task="generation",
            system_prompt="You are a Chart.js expert. Generate valid Chart.js configuration JSON only. No markdown, no explanations, just JSON, no backticks.",
            temperature=0.3
        )

        if chart_response and chart_response.content:
            chart = json.loads(chart_response.content)
            if isinstance(chart, dict):
                return chart
            elif isinstance(chart, list) and len(chart) > 0:
                return chart[0]
    except json.JSONDecodeError as e:
        logger.error(
            f"[AGENT 3] Failed to parse chart {chart_index} JSON: {e}")
    except Exception as e:
        logger.error(f"[AGENT 3] Error generating chart {chart_index}: {e}")

    return None


def _generate_charts(num_charts: int, query: str, analyzed_data: str, prompt_data: Dict) -> List[Dict[str, Any]]:
    """
    Generate Chart.js configurations for chart placeholders.

    Optimized: Generates all charts in parallel for better performance.
    """
    if num_charts == 0:
        return []

    # For single chart, use simple generation
    if num_charts == 1:
        chart = _generate_single_chart(1, query, analyzed_data, prompt_data)
        return [chart] if chart else []

    # For multiple charts, generate in parallel
    logger.info(f"[AGENT 3] Generating {num_charts} charts in parallel...")
    charts = []

    with ThreadPoolExecutor(max_workers=num_charts) as executor:
        futures = {
            executor.submit(_generate_single_chart, i, query, analyzed_data, prompt_data): i
            for i in range(1, num_charts + 1)
        }

        for future in as_completed(futures):
            chart_index = futures[future]
            try:
                chart = future.result()
                if chart:
                    charts.append(chart)
                    logger.debug(
                        f"[AGENT 3] Generated chart {chart_index} successfully")
            except Exception as e:
                logger.error(
                    f"[AGENT 3] Error generating chart {chart_index}: {e}")

    logger.info(
        f"[AGENT 3] Generated {len(charts)}/{num_charts} charts successfully")
    return charts


def _remove_sources_from_text(text: str) -> str:
    """Remove sources section from text if LLM included it."""
    if "## Sources" not in text and "### Sources" not in text:
        return text

    lines = text.split('\n')
    cleaned_lines = []
    skip = False

    for line in lines:
        if line.strip().startswith('## Sources') or line.strip().startswith('### Sources'):
            skip = True
            continue
        if skip and line.strip().startswith('#'):
            skip = False
            cleaned_lines.append(line)
            continue
        if skip:
            continue
        cleaned_lines.append(line)

    return '\n'.join(cleaned_lines).strip()


def text_explanation_node(state: AgentState) -> Dict[str, Any]:
    """Generate text explanation and charts separately."""
    logger.info(
        "[AGENT 3] Text explanation node: Generating text and charts...")
    try:
        prompt_data = prompt_loader.load_prompt("agent3_generation")
        system_prompt = prompt_data["system_prompt"]
        user_prompt_template = prompt_data["user_prompt"]

        analysis = state.get("analysis_results")
        analyzed_data = analysis.analysis if analysis else ""
        is_data_empty = (
            not analysis or not analysis.analysis or
            "cannot find" in analyzed_data.lower() or
            "not available" in analyzed_data.lower()
        )

        retrieved_context = state.get("retrieved_context", [])
        sources = _extract_sources(retrieved_context)
        sources_text = _format_sources_text(sources)

        user_prompt = user_prompt_template.format(
            query=state["current_query"],
            analyzed_data=analyzed_data,
            sources=sources_text or "No sources available"
        )

        text_response = llm_manager.generate(
            prompt=user_prompt,
            task="generation",
            system_prompt=system_prompt,
            temperature=0.4
        )

        text = text_response.content.strip() if text_response and text_response.content else ""
        if not text:
            text = f"I apologize, but I was unable to generate a response for your query: {state.get('current_query', 'your question')}."

        if is_data_empty and "cannot find" not in text.lower() and "not available" not in text.lower():
            text = f"I cannot find this information in the available financial reports.\n\n{text}"

        chart_placeholders = re.findall(r'\[CHART:(\d+)\]', text)
        num_charts = len(set(chart_placeholders))
        charts = _generate_charts(
            num_charts, state["current_query"], analyzed_data, prompt_data)

        text_cleaned = _remove_sources_from_text(text)

        response_obj = AnswerResponse(
            text=text_cleaned,
            charts=charts,
            sources=sources,
            metadata={
                "query": state["current_query"],
                "companies": state["processed_query"].companies if state.get("processed_query") else [],
                "metric": analysis.metric if analysis else None
            }
        )

        logger.info(
            f"[AGENT 3] Text explanation: Generated {len(text)} chars, {len(charts)} charts")
        return {"response": response_obj}

    except Exception as e:
        logger.error(f"[AGENT 3] Text explanation error: {e}")
        return {
            "response": AnswerResponse(
                text="I apologize, but I encountered an error generating the response.",
                charts=[],
                sources=[],
                metadata={}
            )
        }


def synthesis_node(state: AgentState) -> Dict[str, Any]:
    """
    Synthesis node - response already generated by text_explanation_node.
    Just pass through or use self-healed response.

    Args:
        state: Current agent state

    Returns:
        Updated state with response
    """
    logger.info("[AGENT 3] Synthesis node: Using LLM-generated response...")

    # Response should already be in state from text_explanation_node or self_heal_node
    existing_response = state.get("response")
    if existing_response:
        logger.info(
            f"[AGENT 3] Synthesis: Response with {len(existing_response.charts)} charts, {len(existing_response.text)} chars")
        return {"response": existing_response}

    # Fallback if no response exists
    logger.warning("[AGENT 3] Synthesis: No response found, creating fallback")
    return {
        "response": AnswerResponse(
            text=f"I apologize, but I was unable to generate a response for your query: {state.get('current_query', 'your question')}.",
            charts=[],
            sources=[],
            metadata={}
        )
    }


def quality_check_node(state: AgentState) -> Dict[str, Any]:
    """
    Validate ONLY chart JSON quality. Text is not validated here.

    Args:
        state: Current agent state

    Returns:
        Updated state with response_valid
    """
    logger.info("[AGENT 3] Quality check node: Validating chart JSON only...")
    try:
        response = state.get("response")
        if not response:
            logger.warning("[AGENT 3] Quality check: No response generated")
            return {
                "response_valid": False,
                "validation_errors": ["No response generated"]
            }

        # Only validate charts - check if Chart.js JSON is valid
        errors = []
        for i, chart in enumerate(response.charts):
            try:
                # Basic Chart.js structure validation
                if not isinstance(chart, dict):
                    errors.append(f"Chart {i+1}: Not a valid JSON object")
                    continue

                if "type" not in chart:
                    errors.append(f"Chart {i+1}: Missing 'type' field")
                elif chart["type"] not in ["line", "bar", "pie", "doughnut"]:
                    errors.append(
                        f"Chart {i+1}: Invalid type '{chart['type']}'")

                if "data" not in chart:
                    errors.append(f"Chart {i+1}: Missing 'data' field")
                elif not isinstance(chart["data"], dict):
                    errors.append(f"Chart {i+1}: 'data' must be an object")
                elif "labels" not in chart["data"] or "datasets" not in chart["data"]:
                    errors.append(
                        f"Chart {i+1}: Missing 'labels' or 'datasets' in data")

            except Exception as e:
                errors.append(f"Chart {i+1}: Validation error - {str(e)}")

        # If charts are invalid, ask LLM to review and heal
        valid = len(errors) == 0

        logger.info(
            f"[AGENT 3] Quality check: Valid={valid}, Chart errors={len(errors)}")
        return {
            "response_valid": valid,
            "validation_errors": errors,
            "self_heal_attempts": state.get("self_heal_attempts", 0)
        }

    except Exception as e:
        logger.error(f"[AGENT 3] Quality check error: {e}")
        import traceback
        logger.error(
            f"[AGENT 3] Quality check traceback: {traceback.format_exc()}")
        return {
            "response_valid": True,  # Default to valid on error
            "validation_errors": [],
            "self_heal_attempts": state.get("self_heal_attempts", 0)
        }


def self_heal_node(state: AgentState) -> Dict[str, Any]:
    """
    Self-heal: Fix ONLY chart JSON errors. Text is not modified.

    Args:
        state: Current agent state

    Returns:
        Updated state with corrected charts
    """
    logger.info("[AGENT 3] Self-heal node: Fixing chart JSON only...")
    try:
        errors = state.get("validation_errors", [])
        current_response = state.get("response")
        attempts = state.get("self_heal_attempts", 0)

        if attempts >= 2:
            logger.warning("[AGENT 3] Self-heal: Max attempts reached")
            return {"response_valid": True}  # Force accept

        if not errors:
            logger.info("[AGENT 3] Self-heal: No errors to fix")
            return {"response_valid": True}

        if not current_response:
            logger.warning("[AGENT 3] Self-heal: No response to heal")
            return {"response_valid": True}

        # Load self-heal prompt
        prompt_data = prompt_loader.load_prompt("self_heal")
        system_prompt = prompt_data["system_prompt"]
        user_prompt_template = prompt_data["user_prompt"]

        # Format prompt with errors and current charts
        user_prompt = user_prompt_template.format(
            errors="\n".join(errors),
            current_charts=json.dumps(current_response.charts, indent=2),
            query=state.get('current_query', '')
        )

        # Generate corrected Chart.js JSON
        chart_response = llm_manager.generate(
            prompt=user_prompt,
            task="self_heal",
            system_prompt=system_prompt,
            temperature=0.2
        )

        if not chart_response or not hasattr(chart_response, 'content'):
            logger.error("[AGENT 3] Self-heal: Invalid LLM response")
            return {"response_valid": True}  # Force accept

        # Parse corrected chart JSON
        try:
            corrected_charts = json.loads(chart_response.content)
            if not isinstance(corrected_charts, list):
                corrected_charts = [
                    corrected_charts] if corrected_charts else []

            # Update only charts, keep text unchanged
            current_response.charts = corrected_charts

        except json.JSONDecodeError as e:
            logger.error(
                f"[AGENT 3] Self-heal: Failed to parse chart JSON: {e}")
            logger.error(
                f"[AGENT 3] Self-heal: Response content: {chart_response.content[:500]}")
            # Keep original charts

        logger.info(
            f"[AGENT 3] Self-heal: Fixed charts (attempt {attempts + 1})")
        return {
            "response": current_response,
            "self_heal_attempts": attempts + 1,
            "response_valid": False  # Will trigger another quality check
        }

    except Exception as e:
        logger.error(f"[AGENT 3] Self-heal error: {e}")
        import traceback
        logger.error(
            f"[AGENT 3] Self-heal traceback: {traceback.format_exc()}")
        return {"response_valid": True}  # Force accept


def memory_update_node(state: AgentState) -> Dict[str, Any]:
    """
    Update conversation memory in Supabase + Qdrant.

    Optimized: Runs in background thread to avoid blocking response.

    Args:
        state: Current agent state

    Returns:
        Updated state (no changes, side effect only)
    """
    logger.info(
        "[AGENT 3] Memory update node: Scheduling memory update in background...")

    # Run memory update in background thread to avoid blocking
    import threading

    def _update_memory_async():
        try:
            from backend.core.ai.memory.manager import get_memory_manager
            memory_manager = get_memory_manager()

            # Prepare conversation data
            from backend.config.database.models import ConversationMessage

            raw_messages = state.get("messages", [])
            # Convert dict messages to ConversationMessage objects if needed
            messages = []
            for msg in raw_messages:
                if isinstance(msg, dict):
                    messages.append(ConversationMessage(
                        role=msg.get("role", "user"),
                        content=msg.get("content", "")
                    ))
                elif isinstance(msg, ConversationMessage):
                    messages.append(msg)
                else:
                    logger.warning(
                        f"[AGENT 3] Memory update: Skipping invalid message type: {type(msg)}")

            # If messages array is empty, construct from current_query and response
            # This handles the case where messages weren't added to state via LangGraph
            if not messages:
                logger.info(
                    "[AGENT 3] Memory update: messages array is empty, constructing from current_query and response")
                current_query = state.get("current_query", "")
                response = state.get("response")

                # Add user query as a message
                if current_query:
                    messages.append(ConversationMessage(
                        role="user",
                        content=current_query
                    ))

                # Add assistant response as a message
                if response and response.text:
                    messages.append(ConversationMessage(
                        role="assistant",
                        content=response.text
                    ))

            logger.info(
                f"[AGENT 3] Memory update: Prepared {len(messages)} messages for storage")

            summary = state.get("conversation_summary")

            # If no summary, generate one using prompt file
            if not summary:
                response = state.get("response")
                query = state.get("current_query", "")
                response_text = response.text if response and response.text else "No response"

                # Load memory summarization prompt
                memory_prompt_data = prompt_loader.load_prompt(
                    "memory_summarization")
                memory_system_prompt = memory_prompt_data.get(
                    "system_prompt", "")
                memory_user_prompt_template = memory_prompt_data.get(
                    "user_prompt", "")

                # Format conversation for summarization
                conversation_text = f"Query: {query}\nResponse: {response_text}"

                summary_prompt = memory_user_prompt_template.format(
                    conversation=conversation_text
                ) if memory_user_prompt_template else f"Summarize this conversation:\nQuery: {query}\nResponse: {response_text}"

                summary_response = llm_manager.generate(
                    prompt=summary_prompt,
                    task="memory_summarization",
                    system_prompt=memory_system_prompt,
                    temperature=0.2
                )
                if summary_response and hasattr(summary_response, 'content'):
                    summary = summary_response.content
                else:
                    logger.warning(
                        "[AGENT 3] Memory update: Failed to generate summary, using fallback")
                    summary = f"Query: {query}, Response: {response_text}"

            # Store in memory
            from backend.config.database.models import ConversationMetadata

            processed = state.get("processed_query")
            response = state.get("response")

            # Create metadata with companies, years, topics
            metadata_dict = {}
            if processed:
                if processed.companies:
                    metadata_dict["companies"] = processed.companies
                if processed.years:
                    metadata_dict["years"] = processed.years
                if processed.query_type:
                    metadata_dict["topics"] = [processed.query_type]

            # Store charts in metadata so they can be retrieved later
            if response and response.charts:
                metadata_dict["charts"] = response.charts
                metadata_dict["sources"] = response.sources if hasattr(
                    response, 'sources') and response.sources else []

            metadata = ConversationMetadata(
                **metadata_dict) if metadata_dict else None

            memory_manager.store_conversation(
                user_id=state.get("user_id", "unknown"),
                session_id=state.get("session_id", "unknown"),
                messages=messages,
                summary=summary,
                metadata=metadata
            )

            logger.info("[AGENT 3] Memory update: Memory updated successfully")
        except Exception as e:
            logger.error(f"[AGENT 3] Memory update error (background): {e}")
            import traceback
            logger.error(
                f"[AGENT 3] Memory update traceback: {traceback.format_exc()}")

    # Start background thread
    thread = threading.Thread(target=_update_memory_async, daemon=True)
    thread.start()

    # Return immediately (non-blocking)
    return {}
