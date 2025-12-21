"""
Agent 2: Analysis & Validation Agent - Node implementations
"""

from typing import Dict, Any

from backend.core.ai.agent.state import AgentState, AnalysisResult
from backend.core.ai.llm import llm_manager
from backend.config.prompts import prompt_loader
from backend.core.utils.async_logger import get_async_logger

# Use async logger for non-blocking I/O
logger = get_async_logger(__name__)


def analysis_node(state: AgentState) -> Dict[str, Any]:
    """
    Analyze retrieved chunks and extract financial metrics/calculations.

    Args:
        state: Current agent state

    Returns:
        Updated state with analysis_results
    """
    retrieved_context = state.get("retrieved_context", [])
    logger.info(
        f"[AGENT 2] Analysis node: Analyzing {len(retrieved_context)} retrieved chunks...")

    if not retrieved_context:
        logger.warning("[AGENT 2] Analysis: No retrieved context available")
        return {
            "analysis_results": AnalysisResult(
                metric=None,
                analysis="No retrieved context available for analysis."
            )
        }

    try:
        prompt_data = prompt_loader.load_prompt("agent2_analysis")
        system_prompt = prompt_data["system_prompt"]
        user_prompt_template = prompt_data["user_prompt"]

        # Format retrieved context (use metadata, not top-level fields)
        context_text = "\n\n---\n\n".join([
            f"[{i+1}] Company: {chunk.metadata.get('company', 'Unknown')}, Year: {chunk.metadata.get('fiscal_year', chunk.metadata.get('year', 'N/A'))}\n{chunk.content}"
            for i, chunk in enumerate(retrieved_context)
        ])

        # Format user prompt
        processed = state.get("processed_query")
        required_companies = ", ".join(
            processed.companies) if processed and processed.companies else "Any"
        required_years = ", ".join(
            map(str, processed.years)) if processed and processed.years else "Any"

        user_prompt = user_prompt_template.format(
            query=state["current_query"],
            retrieved_content=context_text,
            required_companies=required_companies,
            required_years=required_years,
            required_metrics="Any relevant metrics"
        )

        # Generate analysis with instructor - returns Pydantic model directly
        analysis = llm_manager.generate_structured(
            prompt=user_prompt,
            response_model=AnalysisResult,
            task="analysis",
            system_prompt=system_prompt,
            temperature=0.2
        )

        # Log analysis results
        logger.info(f"[AGENT 2] Analysis complete: Metric={analysis.metric}")
        logger.info(f"[AGENT 2] Analysis: {analysis.analysis[:200]}..." if len(
            analysis.analysis) > 200 else f"[AGENT 2] Analysis: {analysis.analysis}")

        return {"analysis_results": analysis}

    except Exception as e:
        logger.error(f"[AGENT 2] Analysis error: {e}")
        # Return empty analysis on error
        return {
            "analysis_results": AnalysisResult(
                metric=None,
                analysis=f"Error during analysis: {str(e)}"
            )
        }


def validation_node(state: AgentState) -> Dict[str, Any]:
    """
    Validate analysis results for completeness and accuracy.

    Args:
        state: Current agent state

    Returns:
        Updated state with validation status
    """
    try:
        prompt_data = prompt_loader.load_prompt("agent2_analysis")
        system_prompt = prompt_data["system_prompt"]

        analysis = state.get("analysis_results")
        if not analysis:
            return {"validation_errors": ["No analysis results to validate"]}

        # Format validation prompt
        processed = state.get("processed_query")
        required_companies = ", ".join(
            processed.companies) if processed and processed.companies else "Any"
        required_years = ", ".join(
            map(str, processed.years)) if processed and processed.years else "Any"

        # Use validation_prompt from YAML if available
        validation_prompt_template = prompt_data.get("validation_prompt")
        if not validation_prompt_template:
            # Fallback if not in YAML
            validation_prompt_template = """
            Validate the analysis for: {query}
            
            Analysis:
            Metric: {metric}
            Analysis: {analysis}
            
            Required: Companies: {required_companies}, Years: {required_years}
            
            Check:
            1. Are requested companies mentioned in the analysis?
            2. Are requested years mentioned in the analysis?
            3. Are specific values included?
            4. Is the analysis consistent with the query?
            """

        validation_prompt = validation_prompt_template.format(
            query=state["current_query"],
            metric=analysis.metric or "None",
            analysis=analysis.analysis,
            required_companies=required_companies,
            required_years=required_years
        )

        # Generate validation with instructor - returns Pydantic model directly
        from backend.core.ai.agent.state import AnalysisValidationResponse

        validation_result = llm_manager.generate_structured(
            prompt=validation_prompt,
            response_model=AnalysisValidationResponse,
            task="analysis",
            system_prompt=system_prompt,
            temperature=0.1
        )

        valid = validation_result.valid
        errors = validation_result.errors
        warnings = validation_result.warnings

        if warnings:
            logger.warning(f"[AGENT 2] Validation warnings: {warnings}")
        if errors:
            logger.error(f"[AGENT 2] Validation errors: {errors}")

        logger.info(
            f"[AGENT 2] Validation: Valid={valid}, Errors={len(errors)}")
        return {
            "validation_errors": errors if not valid else [],
            "analysis_results": analysis  # Keep analysis even if invalid
        }

    except Exception as e:
        logger.error(f"[AGENT 2] Validation error: {e}")
        return {"validation_errors": [f"Validation error: {str(e)}"]}
