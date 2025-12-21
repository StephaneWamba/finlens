"""Main retrieval interface for semantic and keyword search over financial documents."""

from typing import List, Dict, Any, Optional, Tuple
from backend.core.ai.vector_db.qdrant_client import QdrantClient, get_qdrant_client
from backend.core.ai.retrieval.query_processor import QueryProcessor
from backend.core.ai.retrieval.keyword_search import KeywordSearcher
from backend.config.settings import settings
import threading


class Retriever:
    """Main retrieval interface."""

    def __init__(
        self,
        qdrant_client: QdrantClient = None,
        query_processor: QueryProcessor = None,
        use_cross_encoder: bool = False
    ):
        from backend.core.ai.retrieval.query_processor import get_query_processor
        self.qdrant = qdrant_client or get_qdrant_client()
        self.query_processor = query_processor or get_query_processor()
        self.keyword_searcher = KeywordSearcher()
        self.use_cross_encoder = use_cross_encoder
        self.cross_encoder = None

        # Lazy load cross-encoder if requested
        if use_cross_encoder:
            try:
                from sentence_transformers import CrossEncoder
                self.cross_encoder = CrossEncoder(
                    'cross-encoder/ms-marco-MiniLM-L-6-v2')
            except ImportError:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(
                    "sentence-transformers not installed. Using keyword-based reranking.")
                self.use_cross_encoder = False

    def retrieve(
        self,
        query: str,
        user_id: str,
        top_k: int = None,
        company: Optional[str] = None,
        companies: Optional[List[str]] = None,
        year: Optional[int] = None,
        year_range: Optional[Tuple[int, int]] = None,
        use_hybrid: bool = True,
        expand_query: bool = True,  # Default to True - always use LLM processing
        # NEW METADATA FILTERS
        document_type: Optional[str] = None,
        document_types: Optional[List[str]] = None,
        document_category: Optional[str] = None,
        fiscal_quarter: Optional[int] = None,
        sector: Optional[str] = None,
        sectors: Optional[List[str]] = None,
        industry: Optional[str] = None,
        has_financial_statements: Optional[bool] = None,
        has_mda: Optional[bool] = None,
        has_risk_factors: Optional[bool] = None,
        period_type: Optional[str] = None,
        reporting_standard: Optional[str] = None,
        country: Optional[str] = None,
        exchange: Optional[str] = None,
        chunk_type: Optional[str] = None,
        has_table: Optional[bool] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant chunks for a query from user's documents.

        Args:
            query: User query text
            user_id: User UUID string (REQUIRED - security filter)
            top_k: Number of results to return
            company: Filter by single company (optional)
            companies: Filter by multiple companies (optional, takes priority over company)
            year: Filter by single fiscal year (optional)
            year_range: Filter by fiscal year range (optional, tuple of (min, max))
            use_hybrid: Use hybrid search (semantic + keyword) (default: True)
            expand_query: Expand query using LLM (default: True)
            document_type: Filter by document type (optional, e.g., "10-K", "10-Q")
            document_types: Filter by multiple document types (optional)
            document_category: Filter by document category (optional)
            fiscal_quarter: Filter by fiscal quarter (optional, 1-4)
            sector: Filter by company sector (optional, e.g., "Technology")
            sectors: Filter by multiple sectors (optional)
            industry: Filter by company industry (optional)
            has_financial_statements: Filter by financial statements presence (optional)
            has_mda: Filter by MD&A presence (optional)
            has_risk_factors: Filter by risk factors presence (optional)
            period_type: Filter by period type (optional, e.g., "annual", "quarterly")
            reporting_standard: Filter by reporting standard (optional, e.g., "GAAP", "IFRS")
            country: Filter by company country (optional)
            exchange: Filter by stock exchange (optional, e.g., "NYSE", "NASDAQ")
            chunk_type: Filter by chunk type (optional, e.g., "heading", "table", "paragraph")
            has_table: Filter by table presence in chunk (optional)

        Returns:
            List of retrieved chunk dictionaries with content, score, and metadata
        """
        if not user_id:
            raise ValueError("user_id is required for retrieval")

        if top_k is None:
            top_k = settings.TOP_K_FINAL

        # Process query (with optional expansion)
        processed = self.query_processor.process_query(
            query, company, year, expand=expand_query)

        # Extract filters from processed query
        filters = processed.get('filters', {})

        # Determine company filter (prefer explicit companies parameter, then extracted companies, then single company)
        # Note: Company is now a metadata filter, not a collection selector
        if companies:
            company_filter = companies
        elif processed.get('companies') and len(processed['companies']) > 1:
            # Multiple companies extracted from query
            company_filter = processed['companies']
        else:
            # Single company or None
            company_filter = filters.get('company')

        # Determine year filter (prefer explicit year_range, then extracted year_range, then single year)
        if year_range:
            final_year_range = year_range
            year_filter = None
        elif processed.get('year_range'):
            final_year_range = processed['year_range']
            year_filter = None
        else:
            final_year_range = None
            year_filter = filters.get('year')

        # Extract metadata filters from processed query (NEW)
        # Priority: explicit parameters > LLM-extracted from query
        final_document_type = document_type or filters.get('document_type')
        final_document_category = document_category or filters.get(
            'document_category')
        final_fiscal_quarter = fiscal_quarter if fiscal_quarter is not None else filters.get(
            'fiscal_quarter')
        final_sector = sector or filters.get('sector')
        final_period_type = period_type or filters.get('period_type')
        final_reporting_standard = reporting_standard or filters.get(
            'reporting_standard')
        final_exchange = exchange or filters.get('exchange')
        final_has_financial_statements = has_financial_statements if has_financial_statements is not None else filters.get(
            'has_financial_statements')
        final_has_mda = has_mda if has_mda is not None else filters.get(
            'has_mda')
        final_has_risk_factors = has_risk_factors if has_risk_factors is not None else filters.get(
            'has_risk_factors')
        final_chunk_type = chunk_type or filters.get('chunk_type')

        # Perform search (always includes user_id filter)
        if use_hybrid:
            results = self.qdrant.hybrid_search(
                query_vector=processed['query_embedding'],
                query_text=processed['query_text'],
                user_id=user_id,
                top_k=settings.TOP_K_INITIAL,  # Get more for reranking
                alpha=settings.HYBRID_SEARCH_ALPHA,
                company=company_filter if isinstance(
                    company_filter, str) else None,
                companies=company_filter if isinstance(
                    company_filter, list) else None,
                year=year_filter,
                year_range=final_year_range,
                # Pass all metadata filters (explicit or LLM-extracted)
                document_type=final_document_type,
                document_types=document_types,
                document_category=final_document_category,
                fiscal_quarter=final_fiscal_quarter,
                sector=final_sector,
                sectors=sectors,
                industry=industry,
                has_financial_statements=final_has_financial_statements,
                has_mda=final_has_mda,
                has_risk_factors=final_has_risk_factors,
                period_type=final_period_type,
                reporting_standard=final_reporting_standard,
                country=country,
                exchange=final_exchange
            )
        else:
            results = self.qdrant.search(
                query_vector=processed['query_embedding'],
                user_id=user_id,
                top_k=settings.TOP_K_INITIAL,
                company=company_filter if isinstance(
                    company_filter, str) else None,
                companies=company_filter if isinstance(
                    company_filter, list) else None,
                year=year_filter,
                year_range=final_year_range,
                # Pass all metadata filters (explicit or LLM-extracted)
                document_type=final_document_type,
                document_types=document_types,
                document_category=final_document_category,
                fiscal_quarter=final_fiscal_quarter,
                sector=final_sector,
                sectors=sectors,
                industry=industry,
                has_financial_statements=final_has_financial_statements,
                has_mda=final_has_mda,
                has_risk_factors=final_has_risk_factors,
                period_type=final_period_type,
                reporting_standard=final_reporting_standard,
                country=country,
                exchange=final_exchange,
                chunk_type=final_chunk_type,
                has_table=has_table
            )

        # Simple reranking (can be enhanced with cross-encoder)
        # Use expanded query text for reranking if available, otherwise original
        rerank_query = processed.get('query_text', query)
        reranked = self._rerank(results, rerank_query)

        # Return top K
        return reranked[:top_k]

    def _rerank(
        self,
        results: List[Dict[str, Any]],
        query_text: str
    ) -> List[Dict[str, Any]]:
        """Rerank results using cross-encoder or enhanced keyword search."""
        if not results:
            return results

        # Use cross-encoder if available
        if self.use_cross_encoder and self.cross_encoder:
            return self._rerank_with_cross_encoder(results, query_text)

        # Otherwise use enhanced keyword-based reranking
        return self._rerank_with_keywords(results, query_text)

    def _rerank_with_cross_encoder(
        self,
        results: List[Dict[str, Any]],
        query_text: str
    ) -> List[Dict[str, Any]]:
        """Rerank using cross-encoder model."""
        # Prepare pairs for cross-encoder
        pairs = [[query_text, result['content']] for result in results]

        # Get scores from cross-encoder
        scores = self.cross_encoder.predict(pairs)

        # Update results with rerank scores
        for result, score in zip(results, scores):
            # Combine original score with cross-encoder score
            # Cross-encoder provides more accurate relevance
            result['rerank_score'] = float(score)
            result['cross_encoder_score'] = float(score)

        # Sort by rerank score
        results.sort(key=lambda x: x['rerank_score'], reverse=True)
        return results

    def _rerank_with_keywords(
        self,
        results: List[Dict[str, Any]],
        query_text: str
    ) -> List[Dict[str, Any]]:
        """Rerank using enhanced keyword search with BM25."""
        for result in results:
            # Get original semantic score
            semantic_score = result.get('score', 0.0)

            # Calculate proper keyword relevance
            keyword_score = self.keyword_searcher.calculate_keyword_relevance(
                query=query_text,
                content=result['content'],
                use_phrases=True
            )

            # Normalize semantic score if needed
            normalized_semantic = max(0.0, min(
                1.0, (semantic_score + 1) / 2)) if semantic_score < 0 else semantic_score

            # Weighted combination (favor semantic slightly more)
            rerank_score = (
                0.6 * normalized_semantic +
                0.4 * keyword_score
            )

            result['rerank_score'] = rerank_score
            result['keyword_rerank_score'] = keyword_score

        # Sort by rerank score
        results.sort(key=lambda x: x['rerank_score'], reverse=True)
        return results


# Singleton instance for Retriever
_retriever_instance = None
_retriever_lock = threading.Lock()


def get_retriever(qdrant_client: QdrantClient = None, query_processor: QueryProcessor = None, use_cross_encoder: bool = False):
    """Get singleton Retriever instance."""
    global _retriever_instance
    # If custom parameters provided, create new instance (for testing/special cases)
    if qdrant_client is not None or query_processor is not None or use_cross_encoder:
        return Retriever(qdrant_client=qdrant_client, query_processor=query_processor, use_cross_encoder=use_cross_encoder)

    # Return singleton for normal use
    if _retriever_instance is None:
        with _retriever_lock:
            if _retriever_instance is None:
                _retriever_instance = Retriever()
                import logging
                logger = logging.getLogger(__name__)
                logger.debug("Retriever singleton instance created")
    return _retriever_instance
