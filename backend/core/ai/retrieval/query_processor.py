"""
Query processing and augmentation using LLM-powered extraction.

Extracts entities (companies, years, ranges), augments queries with financial terminology,
and generates query embeddings. All processing done via LLM calls.
"""

from typing import Dict, Any, Optional, Union
from backend.core.ai.embedding.openai_embedder import OpenAIEmbedder
from backend.core.ai.embedding.voyage_embedder import VoyageEmbedder
from backend.core.ai.embedding.manager import EmbeddingManager
from backend.core.ai.retrieval.llm_query_augmenter import LLMQueryAugmenter
import threading


class QueryProcessor:
    """
    Processes and augments user queries using LLM-powered processing.

    All entity extraction and query augmentation is done by LLM - no heuristics.
    """

    def __init__(self, embedder: OpenAIEmbedder | VoyageEmbedder | EmbeddingManager | None = None, llm_augmenter: LLMQueryAugmenter | None = None):
        if embedder is None:
            # Use singleton EmbeddingManager to get the configured embedder
            from backend.core.ai.embedding.manager import get_embedding_manager
            embedding_manager = get_embedding_manager()
            self.embedder = embedding_manager.embedder
            self.embedding_manager = embedding_manager
        elif isinstance(embedder, EmbeddingManager):
            self.embedding_manager = embedder
            self.embedder = embedder.embedder
        else:
            # Direct embedder provided
            self.embedder = embedder
            self.embedding_manager = None
        self.llm_augmenter = llm_augmenter or LLMQueryAugmenter()

    def process_query(
        self,
        query: str,
        company: Optional[str] = None,
        year: Optional[int] = None,
        expand: bool = True  # Default to True - always use LLM processing
    ) -> Dict[str, Any]:
        """
        Process a user query using LLM for all extraction and augmentation.

        Args:
            query: User's query text
            company: Optional company filter (overrides LLM extraction if provided)
            year: Optional year filter (overrides LLM extraction if provided)
            expand: Whether to use LLM processing (default: True)

        Returns:
            Processed query dictionary with embedding and extracted entities
        """
        # Always use LLM for processing (extraction + augmentation)
        if expand:
            # Use LLM to extract entities AND augment query
            llm_result = self.llm_augmenter.process_and_augment_query(query)

            # Extract entities from LLM result
            extracted_companies = llm_result.get('companies', [])
            extracted_year = llm_result.get('year')
            extracted_year_range = llm_result.get('year_range')
            augmented_query = llm_result.get('augmented_query', query)

            # Extract metadata filters from LLM result (NEW)
            document_type = llm_result.get('document_type')
            document_category = llm_result.get('document_category')
            fiscal_quarter = llm_result.get('fiscal_quarter')
            sector = llm_result.get('sector')
            period_type = llm_result.get('period_type')
            reporting_standard = llm_result.get('reporting_standard')
            exchange = llm_result.get('exchange')
            has_financial_statements = llm_result.get('has_financial_statements')
            has_mda = llm_result.get('has_mda')
            has_risk_factors = llm_result.get('has_risk_factors')
            chunk_type = llm_result.get('chunk_type')
            needs_year_expansion = llm_result.get('needs_year_expansion')

            # Use provided filters if given, otherwise use LLM-extracted
            final_company = company if company else (
                extracted_companies[0] if extracted_companies else None)
            final_companies = extracted_companies if len(
                extracted_companies) > 1 else None
            final_year = year if year else extracted_year
            final_year_range = extracted_year_range

            # Smart year range expansion (Phase 4)
            # Only expand if query explicitly asks for trends/comparisons
            # If needs_year_expansion is True, expand for trend analysis
            # If needs_year_expansion is False or None, keep exact year/year_range
            should_expand = needs_year_expansion is True

            if should_expand:
                # Expand year range to include adjacent years for trend/comparison queries
                # Annual reports contain data for multiple years (current + prior year comparisons)
                if final_year_range:
                    # Already a range - expand it by 1 year on each side for better context
                    final_year_range = (max(2015, final_year_range[0] - 1),
                                        min(2025, final_year_range[1] + 1))
                elif final_year:
                    # Single year - expand to range (year-1, year+1) for context
                    final_year_range = (max(2015, final_year - 1),
                                        min(2025, final_year + 1))
                    final_year = None  # Clear single year since we're using range
            # else: Keep exact year/year_range (no expansion for specific value queries)

            query_text = augmented_query
        else:
            # No LLM processing - use query as-is
            query_text = query
            final_company = company
            final_companies = None
            final_year = year
            final_year_range = None
            # No metadata filters when not using LLM
            document_type = None
            document_category = None
            fiscal_quarter = None
            sector = None
            period_type = None
            reporting_standard = None
            exchange = None
            has_financial_statements = None
            has_mda = None
            has_risk_factors = None
            chunk_type = None

        # Generate query embedding from augmented/original query
        # Use query-specific embedding if available (Voyage AI)
        if self.embedding_manager:
            query_embedding = self.embedding_manager.embed_query(query_text)
        elif isinstance(self.embedder, VoyageEmbedder):
            query_embedding = self.embedder.embed_query(query_text)
        else:
            query_embedding = self.embedder.embed_text(query_text)

        return {
            'query_text': query_text,  # Use augmented for search
            'original_query': query,  # Keep original for display
            'query_embedding': query_embedding,
            'company': final_company,
            'companies': final_companies,  # All companies if multiple
            'year': final_year,
            # Convert list to tuple
            'year_range': tuple(final_year_range) if final_year_range else None,
            'filters': {
                'company': final_company,
                'companies': final_companies,
                'year': final_year,
                'year_range': tuple(final_year_range) if final_year_range else None,
                # NEW: Add metadata filters
                'document_type': document_type,
                'document_category': document_category,
                'fiscal_quarter': fiscal_quarter,
                'sector': sector,
                'period_type': period_type,
                'reporting_standard': reporting_standard,
                'exchange': exchange,
                'has_financial_statements': has_financial_statements,
                'has_mda': has_mda,
                'has_risk_factors': has_risk_factors,
                'chunk_type': chunk_type,
            }
        }


# Singleton instance for QueryProcessor
_query_processor_instance = None
_query_processor_lock = threading.Lock()


def get_query_processor(embedder: OpenAIEmbedder | VoyageEmbedder | EmbeddingManager | None = None, llm_augmenter: LLMQueryAugmenter | None = None) -> QueryProcessor:
    """
    Get singleton QueryProcessor instance.
    
    Creates the instance on first call and reuses it for all subsequent calls.
    This prevents redundant initialization and reduces memory usage.
    
    Args:
        embedder: Optional custom embedder (creates new instance if provided)
        llm_augmenter: Optional custom LLM augmenter (creates new instance if provided)
    
    Returns:
        Singleton QueryProcessor instance (or new instance if custom params provided)
    """
    global _query_processor_instance
    # If custom parameters provided, create new instance (for testing/special cases)
    if embedder is not None or llm_augmenter is not None:
        return QueryProcessor(embedder=embedder, llm_augmenter=llm_augmenter)
    
    # Return singleton for normal use
    if _query_processor_instance is None:
        with _query_processor_lock:
            if _query_processor_instance is None:
                _query_processor_instance = QueryProcessor()
                import logging
                logger = logging.getLogger(__name__)
                logger.debug("QueryProcessor singleton instance created")
    return _query_processor_instance
