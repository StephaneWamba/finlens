"""
Agent 1: Query & Retrieval Agent - Node implementations
"""

from typing import Dict, Any, List

from backend.core.ai.agent.state import (
    AgentState, ProcessedQuery, RetrievedChunk,
    SubQuery, QueryDecompositionResponse
)
from backend.core.ai.memory.manager import get_memory_manager
from backend.core.ai.retrieval.retriever import get_retriever
from backend.core.ai.retrieval.query_processor import get_query_processor
from backend.core.ai.llm import llm_manager
from backend.config.prompts import prompt_loader
from backend.config.constants import (
    DEFAULT_TOP_K, DEFAULT_TOP_K_MULTI_COMPANY_MULTIPLIER,
    CONTENT_HASH_LENGTH, CONTENT_PREVIEW_LENGTH
)
from concurrent.futures import ThreadPoolExecutor, as_completed
from backend.core.utils.async_logger import get_async_logger

# Use async logger for non-blocking I/O
logger = get_async_logger(__name__)


def memory_check_node(state: AgentState) -> Dict[str, Any]:
    """
    Check memory for relevant past conversations (cross-session).

    Args:
        state: Current agent state

    Returns:
        Updated state with relevant_history
    """
    logger.info(
        "[AGENT 1] Memory check node: Checking for relevant past conversations...")
    try:
        memory_manager = get_memory_manager()
        relevant = memory_manager.get_relevant_memory(
            user_id=state["user_id"],
            query=state["current_query"],
            limit=5
        )

        logger.info(
            f"[AGENT 1] Memory check: Found {len(relevant)} relevant past conversations")
        return {"relevant_history": relevant}

    except Exception as e:
        logger.error(f"[AGENT 1] Memory check error: {e}")
        return {"relevant_history": []}


def memory_check_and_query_processing_node(state: AgentState) -> Dict[str, Any]:
    """
    Combined node: Run memory check and query processing in parallel.

    Optimized: Both operations run concurrently for better performance.
    Memory context is optional - query processing can proceed without it.

    Args:
        state: Current agent state

    Returns:
        Updated state with relevant_history and processed_query/sub_queries
    """
    logger.info(
        "[AGENT 1] Combined node: Running memory check and query processing in parallel...")

    # Run both operations in parallel
    memory_result: Dict[str, Any] = {}
    query_result: Dict[str, Any] = {}

    def run_memory_check():
        try:
            memory_manager = get_memory_manager()
            relevant = memory_manager.get_relevant_memory(
                user_id=state["user_id"],
                query=state["current_query"],
                limit=5
            )
            return {"relevant_history": relevant}
        except Exception as e:
            logger.error(f"[AGENT 1] Memory check error: {e}")
            return {"relevant_history": []}

    def run_query_processing():
        # Query processing can work without memory context (it's optional)
        # We'll inject memory context later if available
        try:
            # Step 1: Check if query needs decomposition
            decomposition_result = decompose_query_if_needed(
                state["current_query"])

            if decomposition_result.needs_decomposition and decomposition_result.sub_queries:
                # Multi-part query - process each sub-query
                logger.info(
                    f"[AGENT 1] Query processing: Query decomposed into {len(decomposition_result.sub_queries)} sub-queries")

                # Process each sub-query to get augmented queries
                processed_sub_queries = []
                for sq in decomposition_result.sub_queries:
                    # Use QueryProcessor to augment each sub-query
                    query_processor = get_query_processor()
                    processed = query_processor.process_query(
                        sq.sub_query,
                        company=sq.companies[0] if sq.companies and len(
                            sq.companies) == 1 else None,
                        year=sq.years[0] if sq.years and len(
                            sq.years) == 1 else None,
                        expand=True
                    )

                    # Update sub-query with augmented query
                    sq.augmented_query = processed.get(
                        "query_text", sq.sub_query)
                    processed_sub_queries.append(sq)

                return {
                    "processed_query": None,
                    "sub_queries": processed_sub_queries,
                    "is_decomposed": True
                }

            # Step 2: Single query - process normally
            logger.info(
                "[AGENT 1] Query processing: Processing as single query")
            # Get prompt
            prompt_data = prompt_loader.load_prompt("agent1_retrieval")
            system_prompt = prompt_data["system_prompt"]
            user_prompt_template = prompt_data["user_prompt"]

            # Format prompt - memory context will be injected if available
            # For now, proceed without it (it's optional)
            user_prompt = user_prompt_template.format(
                query=state["current_query"],
                # Will be updated if memory check completes
                memory_context="No previous context"
            )

            # Generate with instructor - returns Pydantic model directly
            from backend.core.ai.agent.state import QueryProcessingResponse

            llm_response = llm_manager.generate_structured(
                prompt=user_prompt,
                response_model=QueryProcessingResponse,
                task="query_augmentation",
                system_prompt=system_prompt,
                temperature=0.3
            )

            # Convert LLM response to ProcessedQuery
            processed_query = ProcessedQuery(
                query_text=state["current_query"],
                companies=llm_response.companies,
                years=llm_response.years,
                year_range=tuple(
                    llm_response.year_range) if llm_response.year_range else None,
                query_type=llm_response.query_type,
                augmented_query=llm_response.augmented_query
            )

            logger.info(
                f"[AGENT 1] Query processing: Type={processed_query.query_type}, Companies={processed_query.companies}, Years={processed_query.years}")
            return {"processed_query": processed_query}

        except Exception as e:
            logger.error(f"[AGENT 1] Query processing error: {e}")
            # Fallback to basic processing
            query_processor = get_query_processor()
            processed = query_processor.process_query(state["current_query"])

            processed_query = ProcessedQuery(
                query_text=processed["query_text"],
                companies=processed.get("companies", []),
                years=processed.get("filters", {}).get("year"),
                year_range=processed.get("year_range"),
                query_type="general",
                augmented_query=processed["query_text"]
            )
            return {"processed_query": processed_query}

    # Run both in parallel
    with ThreadPoolExecutor(max_workers=2) as executor:
        memory_future = executor.submit(run_memory_check)
        query_future = executor.submit(run_query_processing)

        # Wait for both to complete
        memory_result = memory_future.result()
        query_result = query_future.result()

    # If memory check completed and we have a single query (not decomposed),
    # we could re-run query processing with memory context, but it's optional
    # and would add latency. For now, we'll use memory context in the next step.

    logger.info(
        f"[AGENT 1] Combined node: Memory check found {len(memory_result.get('relevant_history', []))} conversations, "
        f"Query processing completed")

    # Merge results
    return {**memory_result, **query_result}


def decompose_query_if_needed(query: str) -> QueryDecompositionResponse:
    """
    Check if query needs decomposition and break it down into sub-queries.

    Args:
        query: Original user query

    Returns:
        QueryDecompositionResponse with sub-queries if needed
    """
    logger.info(
        "[AGENT 1] Decomposition: Checking if query needs decomposition...")

    prompt = f"""Analyze this query and determine if it needs decomposition into sub-queries.

Query: "{query}"

A query needs decomposition if it:
- Contains multiple questions (separated by periods, question marks, or "and", "also")
- Asks for multiple unrelated metrics in one query
- Requires information from different contexts that should be retrieved separately
- Has multiple independent parts that can be answered separately

If decomposition needed, break into focused sub-queries.
Each sub-query should be independently answerable and focused on one aspect.

Example 1:
Query: "What was Apple's revenue in 2022? Also show their net income and compare to Microsoft."
Sub-queries:
1. "Apple revenue 2022" (intent: revenue_lookup, companies: ["apple"], years: [2022], metrics: ["revenue"])
2. "Apple net income 2022" (intent: income_lookup, companies: ["apple"], years: [2022], metrics: ["net_income"])
3. "Microsoft revenue 2022" (intent: revenue_lookup, companies: ["microsoft"], years: [2022], metrics: ["revenue"])

Example 2:
Query: "Compare Alphabet and Apple revenue growth from 2018 to 2022"
This is a SINGLE query (comparison is one intent) - does NOT need decomposition.

Output structured decomposition with:
- needs_decomposition: boolean
- sub_queries: list of SubQuery objects (each with sub_query, intent, companies, years, metrics, priority)
- reasoning: brief explanation

If needs_decomposition=false, sub_queries should be empty list."""

    try:
        decomposition_result = llm_manager.generate_structured(
            prompt=prompt,
            response_model=QueryDecompositionResponse,
            task="query_decomposition",
            temperature=0.2
        )

        logger.info(
            f"[AGENT 1] Decomposition: needs_decomposition={decomposition_result.needs_decomposition}, "
            f"sub_queries={len(decomposition_result.sub_queries)}"
        )

        return decomposition_result
    except Exception as e:
        logger.error(f"[AGENT 1] Decomposition error: {e}")
        # Default to no decomposition on error
        return QueryDecompositionResponse(
            needs_decomposition=False,
            sub_queries=[],
            reasoning=f"Error during decomposition: {e}"
        )


def query_processing_node(state: AgentState) -> Dict[str, Any]:
    """
    Process and augment query using LLM. Checks for decomposition first.

    If query is decomposed, returns sub_queries instead of processed_query.

    Args:
        state: Current agent state

    Returns:
        Updated state with processed_query OR sub_queries
    """
    logger.info(
        "[AGENT 1] Query processing node: Processing and augmenting query...")
    try:
        # Step 1: Check if query needs decomposition
        decomposition_result = decompose_query_if_needed(
            state["current_query"])

        if decomposition_result.needs_decomposition and decomposition_result.sub_queries:
            # Multi-part query - process each sub-query
            logger.info(
                f"[AGENT 1] Query processing: Query decomposed into {len(decomposition_result.sub_queries)} sub-queries")

            # Process each sub-query to get augmented queries
            processed_sub_queries = []
            for sq in decomposition_result.sub_queries:
                # Use QueryProcessor to augment each sub-query
                query_processor = get_query_processor()
                processed = query_processor.process_query(
                    sq.sub_query,
                    company=sq.companies[0] if sq.companies and len(
                        sq.companies) == 1 else None,
                    year=sq.years[0] if sq.years and len(
                        sq.years) == 1 else None,
                    expand=True
                )

                # Update sub-query with augmented query
                sq.augmented_query = processed.get("query_text", sq.sub_query)
                processed_sub_queries.append(sq)

            return {
                "processed_query": None,  # Will be set per sub-query during retrieval
                "sub_queries": processed_sub_queries,
                "is_decomposed": True
            }

        # Step 2: Single query - process normally
        logger.info("[AGENT 1] Query processing: Processing as single query")
        # Get prompt
        prompt_data = prompt_loader.load_prompt("agent1_retrieval")
        system_prompt = prompt_data["system_prompt"]
        user_prompt_template = prompt_data["user_prompt"]

        # Format prompt with context
        memory_context = ""
        if state.get("relevant_history"):
            memory_context = "\n".join([
                f"Previous: {h.get('summary', '')}"
                for h in state["relevant_history"][:3]
            ])

        user_prompt = user_prompt_template.format(
            query=state["current_query"],
            memory_context=memory_context or "No previous context"
        )

        # Generate with instructor - returns Pydantic model directly
        from backend.core.ai.agent.state import QueryProcessingResponse

        llm_response = llm_manager.generate_structured(
            prompt=user_prompt,
            response_model=QueryProcessingResponse,
            task="query_augmentation",
            system_prompt=system_prompt,
            temperature=0.3
        )

        # Convert LLM response to ProcessedQuery
        processed_query = ProcessedQuery(
            query_text=state["current_query"],
            companies=llm_response.companies,
            years=llm_response.years,
            year_range=tuple(
                llm_response.year_range) if llm_response.year_range else None,
            query_type=llm_response.query_type,
            augmented_query=llm_response.augmented_query
        )

        logger.info(
            f"[AGENT 1] Query processing: Type={processed_query.query_type}, Companies={processed_query.companies}, Years={processed_query.years}")
        return {"processed_query": processed_query}

    except Exception as e:
        logger.error(f"[AGENT 1] Query processing error: {e}")
        # Fallback to basic processing
        query_processor = get_query_processor()
        processed = query_processor.process_query(state["current_query"])

        processed_query = ProcessedQuery(
            query_text=processed["query_text"],
            companies=processed.get("companies", []) or [],
            years=processed.get("filters", {}).get("year"),
            year_range=processed.get("year_range"),
            query_type="general",
            augmented_query=processed["query_text"]
        )
        return {"processed_query": processed_query}


def retrieve_for_subquery(sub_query: SubQuery, user_id: str) -> List[Dict[str, Any]]:
    """
    Retrieve chunks for a single sub-query.

    Args:
        sub_query: SubQuery object
        user_id: User UUID string (REQUIRED)

    Returns:
        List of retrieved chunks (dict format)
    """
    retriever = get_retriever()

    # Normalize companies
    companies = [c.lower() if isinstance(
        c, str) else c for c in sub_query.companies] if sub_query.companies else None
    company = companies[0] if companies and len(companies) == 1 else None

    # Determine year
    year = None
    if sub_query.years and len(sub_query.years) == 1:
        year = sub_query.years[0]

    # Retrieve for this sub-query (use augmented_query if available, otherwise sub_query)
    query_text = sub_query.augmented_query if sub_query.augmented_query else sub_query.sub_query

    # Convert year_range from List[int] to tuple if needed
    year_range = None
    if sub_query.year_range and len(sub_query.year_range) == 2:
        year_range = tuple(sub_query.year_range)

    # For multi-company sub-queries, increase top_k to ensure enough results per company
    base_top_k = 8
    if companies and len(companies) > 1:
        # Get at least 5-6 results per company to ensure comprehensive coverage
        top_k = max(base_top_k, len(companies) * 6)
    else:
        top_k = base_top_k

    results = retriever.retrieve(
        query=query_text,
        user_id=user_id,
        top_k=top_k,
        company=company,
        companies=companies if companies and len(companies) > 1 else None,
        year=year,
        year_range=year_range,
        use_hybrid=True,
        # Expand only if not already augmented
        expand_query=not sub_query.augmented_query
    )

    # Tag results with sub-query intent
    for r in results:
        r['sub_query_intent'] = sub_query.intent
        r['sub_query'] = sub_query.sub_query

    return results


def _deduplicate_chunks(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicate chunks by content hash."""
    seen_content = set()
    unique_chunks = []
    for chunk in chunks:
        content_hash = hash(chunk.get('content', '')[:CONTENT_HASH_LENGTH])
        if content_hash not in seen_content:
            seen_content.add(content_hash)
            unique_chunks.append(chunk)
    return unique_chunks


def _convert_to_retrieved_chunks(results: List[Dict[str, Any]]) -> List[RetrievedChunk]:
    """Convert result dictionaries to RetrievedChunk models."""
    retrieved_chunks = []
    for r in results:
        # Clean: Only metadata dict, no redundant top-level fields
        chunk = RetrievedChunk(
            content=r["content"],
            score=r.get("score", 0.0),
            metadata=r.get("metadata", {})
        )
        if 'sub_query_intent' in r:
            chunk.metadata['sub_query_intent'] = r.get('sub_query_intent')
            chunk.metadata['sub_query'] = r.get('sub_query')
        retrieved_chunks.append(chunk)
    return retrieved_chunks


def _retrieve_decomposed_query(sub_queries: List[SubQuery], user_id: str) -> Dict[str, Any]:
    """Retrieve chunks for decomposed multi-part query."""
    logger.info(
        f"[AGENT 1] Retrieval: Decomposed query - retrieving for {len(sub_queries)} sub-queries in parallel")

    all_chunks_dict = []
    with ThreadPoolExecutor(max_workers=len(sub_queries)) as executor:
        futures = {executor.submit(
            retrieve_for_subquery, sq, user_id): sq for sq in sub_queries}

        for future in as_completed(futures):
            sub_query = futures[future]
            try:
                chunks = future.result()
                all_chunks_dict.extend(chunks)
                logger.info(
                    f"[AGENT 1] Retrieval: Sub-query '{sub_query.intent}' retrieved {len(chunks)} chunks")
            except Exception as e:
                logger.error(
                    f"[AGENT 1] Retrieval: Error retrieving for sub-query '{sub_query.intent}': {e}")

    unique_chunks_dict = sorted(_deduplicate_chunks(
        all_chunks_dict), key=lambda x: x.get('score', 0.0), reverse=True)
    retrieved_chunks = _convert_to_retrieved_chunks(unique_chunks_dict)

    logger.info(
        f"[AGENT 1] Retrieval: Decomposed query - retrieved {len(retrieved_chunks)} unique chunks")

    sub_query_results = {
        sq.intent: [c for c in retrieved_chunks if c.metadata.get(
            'sub_query_intent') == sq.intent]
        for sq in sub_queries
    }

    return {"retrieved_context": retrieved_chunks, "sub_query_results": sub_query_results}


def _retrieve_single_query(processed: ProcessedQuery, user_id: str) -> List[RetrievedChunk]:
    """Retrieve chunks for single query."""
    retriever = get_retriever()

    companies = [c.lower() if isinstance(
        c, str) else c for c in processed.companies] if processed.companies else None
    company = companies[0] if companies and len(companies) == 1 else None
    year = processed.years[0] if processed.years and len(
        processed.years) == 1 else None

    top_k = max(DEFAULT_TOP_K, len(companies) *
                DEFAULT_TOP_K_MULTI_COMPANY_MULTIPLIER) if companies and len(companies) > 1 else DEFAULT_TOP_K

    if companies and len(companies) > 1:
        logger.info(
            f"[AGENT 1] Retrieval: Multi-company query ({len(companies)} companies) - using top_k={top_k}")

    results = retriever.retrieve(
        query=processed.augmented_query,
        user_id=user_id,
        top_k=top_k,
        company=company,
        companies=companies if companies and len(companies) > 1 else None,
        year=year,
        year_range=processed.year_range,
        use_hybrid=True,
        expand_query=True
    )

    return _convert_to_retrieved_chunks(results)


def retrieval_node(state: AgentState) -> Dict[str, Any]:
    """Retrieve relevant chunks from vector DB. Handles both single and decomposed queries."""
    logger.info(
        "[AGENT 1] Retrieval node: Retrieving relevant chunks from vector DB...")
    try:
        user_id = state.get("user_id")
        if not user_id:
            logger.error("[AGENT 1] Retrieval: No user_id in state")
            return {"retrieved_context": []}

        if state.get("is_decomposed") and state.get("sub_queries"):
            return _retrieve_decomposed_query(state["sub_queries"], user_id)

        processed = state.get("processed_query")
        if not processed:
            logger.error("[AGENT 1] Retrieval: No processed_query in state")
            return {"retrieved_context": []}

        retrieved_chunks = _retrieve_single_query(processed, user_id)

        logger.info(
            f"[AGENT 1] Retrieval: Retrieved {len(retrieved_chunks)} chunks")
        if retrieved_chunks:
            top_chunk = retrieved_chunks[0]
            logger.info(
                f"[AGENT 1] Retrieval: Top chunk score={top_chunk.score:.3f}, company={top_chunk.metadata.get('company', 'Unknown')}")
            for i, chunk in enumerate(retrieved_chunks[:3]):
                logger.info(
                    f"[AGENT 1] Retrieval: Chunk {i+1} - Company={chunk.metadata.get('company', 'Unknown')}, Year={chunk.metadata.get('fiscal_year', chunk.metadata.get('year', 'N/A'))}, Score={chunk.score:.3f}, Page={chunk.metadata.get('page_idx', 0)}")

        return {"retrieved_context": retrieved_chunks}
    except Exception as e:
        logger.error(f"[AGENT 1] Retrieval error: {e}")
        return {"retrieved_context": []}


def validation_node(state: AgentState) -> Dict[str, Any]:
    """
    Validate if retrieved content is sufficient.
    Handles both single queries and decomposed multi-part queries.

    Args:
        state: Current agent state

    Returns:
        Updated state with retrieval_sufficient
    """
    logger.info(
        f"[AGENT 1] Validation node: Validating retrieval sufficiency (attempt {state.get('retrieval_attempts', 0) + 1})...")
    try:
        # Check if decomposed query
        if state.get("is_decomposed") and state.get("sub_queries"):
            # Validate each sub-query has sufficient results
            sub_queries = state.get("sub_queries", [])
            sub_query_results = state.get("sub_query_results", {})

            gaps = []
            for sq in sub_queries:
                # Check if chunks exist for this sub-query intent
                relevant_chunks = sub_query_results.get(sq.intent, [])

                if len(relevant_chunks) < 2:  # Need at least 2 chunks per sub-query
                    gaps.append(
                        f"Sub-query '{sq.sub_query}' (intent: {sq.intent}): insufficient results ({len(relevant_chunks)} chunks)")
                    logger.warning(
                        f"[AGENT 1] Validation: Sub-query '{sq.intent}' has insufficient results: {len(relevant_chunks)} chunks")

            sufficient = len(gaps) == 0
            attempts = state.get("retrieval_attempts", 0) + 1

            # Safety: Force sufficient after max attempts
            if attempts >= 3:
                logger.warning(
                    f"[AGENT 1] Validation: Max attempts ({attempts}) reached, forcing sufficient=True")
                sufficient = True

            logger.info(
                f"[AGENT 1] Validation: Decomposed query - Sufficient={sufficient}, Gaps={len(gaps)}, Attempts={attempts}")
            return {
                "retrieval_sufficient": sufficient,
                "retrieval_attempts": attempts,
                "gaps": gaps
            }

        # Single query validation (existing logic)
        prompt_data = prompt_loader.load_prompt("agent1_retrieval")
        system_prompt = prompt_data["system_prompt"]
        user_prompt_template = prompt_data["user_prompt"]

        # Format validation prompt
        retrieved_context = state.get("retrieved_context", [])
        retrieved_content = "\n\n".join([
            f"[{i+1}] Company: {chunk.metadata.get('company', 'Unknown')}, Year: {chunk.metadata.get('fiscal_year', chunk.metadata.get('year', 'N/A'))}, Page: {chunk.metadata.get('page_idx', 0)}\n{chunk.content}"
            for i, chunk in enumerate(retrieved_context[:5])
        ]) if retrieved_context else "No content retrieved"

        # Log retrieved content summary for assessment
        logger.debug(
            f"[AGENT 1] Validation: Retrieved content summary (first {CONTENT_PREVIEW_LENGTH} chars):\n{retrieved_content[:CONTENT_PREVIEW_LENGTH]}...")

        # Use validation_prompt from YAML if available, otherwise fallback
        validation_prompt_template = prompt_data.get(
            "validation_prompt", user_prompt_template)
        user_prompt = validation_prompt_template.format(
            query=state["current_query"],
            retrieved_content=retrieved_content
        )

        # Generate validation with instructor - returns Pydantic model directly
        from backend.core.ai.agent.state import ValidationResponse

        validation_result = llm_manager.generate_structured(
            prompt=user_prompt,
            response_model=ValidationResponse,
            task="query_augmentation",
            system_prompt=system_prompt,
            temperature=0.1
        )

        sufficient = validation_result.sufficient
        gaps = validation_result.gaps

        attempts = state.get("retrieval_attempts", 0) + 1

        # Early exit optimization: Check if no progress made
        previous_gaps = state.get("previous_gaps", [])
        if previous_gaps and set(gaps) == set(previous_gaps):
            # No progress - gaps haven't changed
            logger.warning(
                "[AGENT 1] Validation: No progress made (gaps unchanged), exiting early to avoid wasted iterations")
            sufficient = True

        # Safety: Force sufficient after max attempts
        if attempts >= 3:
            logger.warning(
                f"[AGENT 1] Validation: Max attempts ({attempts}) reached, forcing sufficient=True")
            sufficient = True

        logger.info(
            f"[AGENT 1] Validation: Sufficient={sufficient}, Gaps={gaps}, Attempts={attempts}")
        return {
            "retrieval_sufficient": sufficient,
            "retrieval_attempts": attempts,
            "gaps": gaps,  # Store gaps for refinement
            "previous_gaps": gaps  # Store for next iteration comparison
        }

    except Exception as e:
        logger.error(f"[AGENT 1] Validation error: {e}")
        attempts = state.get("retrieval_attempts", 0) + 1
        # Default to sufficient if validation fails OR if we have chunks OR if max attempts reached
        has_chunks = len(state["retrieved_context"]) > 0
        force_sufficient = has_chunks or attempts >= 3
        logger.warning(
            f"[AGENT 1] Validation: Error fallback - has_chunks={has_chunks}, attempts={attempts}, sufficient={force_sufficient}")
        return {
            "retrieval_sufficient": force_sufficient,
            "retrieval_attempts": attempts,
            "gaps": []
        }


def refinement_node(state: AgentState) -> Dict[str, Any]:
    """
    Refine query if retrieval was insufficient.
    For decomposed queries, refines individual sub-queries.

    Args:
        state: Current agent state

    Returns:
        Updated state with refined processed_query or sub_queries
    """
    try:
        if state.get("retrieval_attempts", 0) >= 3:
            logger.warning("Max retrieval attempts reached")
            return {"retrieval_sufficient": True}  # Force continue

        # Handle decomposed queries
        if state.get("is_decomposed") and state.get("sub_queries"):
            logger.info(
                "[AGENT 1] Refinement: Refining decomposed query sub-queries")
            sub_queries = state.get("sub_queries", [])
            gaps = state.get("gaps", [])

            # Refine sub-queries that have gaps
            refined_sub_queries = []
            for sq in sub_queries:
                # Check if this sub-query has gaps
                has_gap = any(
                    sq.intent in gap or sq.sub_query in gap for gap in gaps)

                if has_gap:
                    # Refine this sub-query
                    query_processor = get_query_processor()
                    # For multi-company sub-queries, we'll handle them in retrieval
                    processed = query_processor.process_query(
                        sq.sub_query,
                        company=sq.companies[0] if sq.companies and len(
                            sq.companies) == 1 else None,
                        year=sq.years[0] if sq.years and len(
                            sq.years) == 1 else None,
                        expand=True
                    )
                    sq.augmented_query = processed.get(
                        "query_text", sq.sub_query)
                    logger.info(
                        f"[AGENT 1] Refinement: Refined sub-query '{sq.intent}': {sq.augmented_query}")

                refined_sub_queries.append(sq)

            return {
                "sub_queries": refined_sub_queries,
                "retrieval_sufficient": False  # Will trigger another retrieval
            }

        # Single query refinement (existing logic)
        processed = state.get("processed_query")
        if not processed:
            logger.error(
                "[AGENT 1] Refinement: No processed_query in state, cannot refine")
            return {"retrieval_sufficient": True}  # Force continue

        # Load refinement prompt
        prompt_data = prompt_loader.load_prompt("agent1_retrieval")
        refinement_prompt_template = prompt_data.get("refinement_prompt")

        if not refinement_prompt_template:
            # Fallback if prompt not in YAML
            refinement_prompt_template = """
            The previous retrieval was insufficient. Refine the query to get better results.
            
            Original query: {query}
            Gaps identified: {gaps}
            Retrieved companies: {companies}
            Retrieved years: {years}
            
            Suggest a refined query that will retrieve the missing information.
            """

        # Format refinement prompt
        gaps_str = "\n".join(state.get("gaps", [])
                             ) if state.get("gaps") else "None"
        companies_str = ", ".join(
            processed.companies) if processed.companies else "None"
        years_str = ", ".join(map(str, processed.years)
                              ) if processed.years else "None"

        user_prompt = refinement_prompt_template.format(
            query=state["current_query"],
            gaps=gaps_str,
            companies=companies_str,
            years=years_str
        )

        # Generate refinement with instructor - returns Pydantic model directly
        from backend.core.ai.agent.state import RefinementResponse

        refinement_result = llm_manager.generate_structured(
            prompt=user_prompt,
            response_model=RefinementResponse,
            task="query_augmentation",
            system_prompt=prompt_data.get("system_prompt", ""),
            temperature=0.3
        )

        refined_query = refinement_result.refined_query

        # Update processed query
        processed.augmented_query = refined_query

        logger.info(f"[AGENT 1] Refinement: Refined query: {refined_query}")
        logger.info(
            f"[AGENT 1] Refinement: Attempts={state.get('retrieval_attempts', 0)}, will retry retrieval")
        return {
            "processed_query": processed,
            "retrieval_sufficient": False  # Will trigger another retrieval
        }

    except Exception as e:
        logger.error(f"[AGENT 1] Refinement error: {e}")
        logger.warning(
            "[AGENT 1] Refinement: Forcing sufficient=True due to error")
        return {"retrieval_sufficient": True}  # Force continue
