"""
Qdrant vector database client for user documents.

Provides client interface for Qdrant with single collection for all users (user_id filtering),
hybrid search, and conditional multi-company result balancing for comparative queries.
"""

from typing import List, Dict, Any, Optional, Tuple
import logging
import threading
from qdrant_client import QdrantClient as Qdrant
from qdrant_client.models import (
    Filter,
    FieldCondition, MatchValue, Range
)
from backend.config.settings import settings

logger = logging.getLogger(__name__)

# Singleton instance for QdrantClient
_qdrant_client_instance: Optional['QdrantClient'] = None
_qdrant_client_lock = threading.Lock()

# Single collection name for all document chunks (all users, filtered by user_id)
DOCUMENT_CHUNKS_COLLECTION = "document_chunks"


class QdrantClient:
    """Client for interacting with Qdrant vector database with single collection and user_id filtering."""

    def __init__(
        self,
        host: str = None,
        port: int = None
    ):
        # Check if using Qdrant Cloud
        if settings.QDRANT_URL:
            # Cloud mode - use URL and API key
            self.client = Qdrant(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY
            )
            logger.info(f"Connected to Qdrant Cloud: {settings.QDRANT_URL}")
            self.host = None
            self.port = None
        else:
            # Local mode - use host and port
            self.host = host or settings.QDRANT_HOST
            self.port = port or settings.QDRANT_PORT
            self.client = Qdrant(host=self.host, port=self.port)
            logger.info(f"Connected to local Qdrant: {self.host}:{self.port}")

        # Lazy import to avoid circular dependency
        self._keyword_searcher = None

    @property
    def keyword_searcher(self):
        """Lazy load keyword searcher to avoid circular imports."""
        if self._keyword_searcher is None:
            from backend.core.ai.retrieval.keyword_search import KeywordSearcher
            self._keyword_searcher = KeywordSearcher()
        return self._keyword_searcher

    def search(
        self,
        query_vector: List[float],
        user_id: str,
        top_k: int = 10,
        company: Optional[str] = None,
        companies: Optional[List[str]] = None,
        year: Optional[int] = None,
        year_range: Optional[Tuple[int, int]] = None,
        # NEW FILTERS
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
        Search for similar chunks in user's documents.

        Args:
            query_vector: Query embedding vector
            user_id: User UUID string (REQUIRED - security filter)
            top_k: Number of results to return
            company: Filter by single company (optional, ignored if companies is provided)
            companies: Filter by multiple companies (optional, takes priority over company)
            year: Filter by single fiscal year (optional)
            year_range: Filter by fiscal year range (optional, tuple of (min, max))
            document_type: Filter by document type (optional)
            document_types: Filter by multiple document types (optional)
            document_category: Filter by document category (optional)
            fiscal_quarter: Filter by fiscal quarter (optional)
            sector: Filter by company sector (optional)
            sectors: Filter by multiple sectors (optional)
            industry: Filter by company industry (optional)
            has_financial_statements: Filter by financial statements presence (optional)
            has_mda: Filter by MD&A presence (optional)
            has_risk_factors: Filter by risk factors presence (optional)
            period_type: Filter by period type (optional)
            reporting_standard: Filter by reporting standard (optional)
            country: Filter by company country (optional)
            exchange: Filter by company exchange (optional)
            chunk_type: Filter by chunk type (optional)
            has_table: Filter by table presence (optional)

        Returns:
            List of similar chunks with scores
        """
        if not user_id:
            raise ValueError("user_id is required for search")

        # Build query filter (always includes user_id)
        query_filter = self._build_query_filter(
            user_id=user_id,
            company=company,
            companies=companies,
            year=year,
            year_range=year_range,
            document_type=document_type,
            document_types=document_types,
            document_category=document_category,
            fiscal_quarter=fiscal_quarter,
            sector=sector,
            sectors=sectors,
            industry=industry,
            has_financial_statements=has_financial_statements,
            has_mda=has_mda,
            has_risk_factors=has_risk_factors,
            period_type=period_type,
            reporting_standard=reporting_standard,
            country=country,
            exchange=exchange,
            chunk_type=chunk_type,
            has_table=has_table
        )

        # Determine target companies for balancing/filtering
        # Priority: companies > company
        # - If companies is provided, use it (even if single item)
        # - Otherwise, use company if provided
        target_companies = []
        if companies and len(companies) > 0:
            target_companies = [c.lower() if isinstance(
                c, str) else c for c in companies]
        elif company:
            target_companies = [company.lower() if isinstance(
                company, str) else company]

        # Perform search
        try:
            search_results = self.client.search(
                collection_name=DOCUMENT_CHUNKS_COLLECTION,
                query_vector=query_vector,
                # Get more for balancing if needed
                limit=top_k * 3 if len(target_companies) > 1 else top_k,
                query_filter=query_filter
            )

            # Convert results to dict format
            results = []
            for result in search_results:
                chunk = {
                    'chunk_id': result.payload.get('chunk_id'),
                    'chunk_type': result.payload.get('chunk_type'),
                    'content': result.payload.get('content'),
                    'score': result.score,
                    'metadata': {
                        'user_id': result.payload.get('user_id'),
                        'document_id': result.payload.get('document_id'),
                        'company': result.payload.get('company'),
                        # Use primary field
                        'fiscal_year': result.payload.get('fiscal_year'),
                        'fiscal_quarter': result.payload.get('fiscal_quarter'),
                        'document_type': result.payload.get('document_type'),
                        'document_category': result.payload.get('document_category'),
                        'company_ticker': result.payload.get('company_ticker'),
                        'company_sector': result.payload.get('company_sector'),
                        'company_industry': result.payload.get('company_industry'),
                        'page_idx': result.payload.get('page_idx'),
                        'page_range': result.payload.get('page_range', []),
                        'char_count': result.payload.get('char_count', 0),
                        'has_table': result.payload.get('has_table', False),
                    }
                }

                if result.payload.get('table_body'):
                    chunk['table_body'] = result.payload.get('table_body')
                    chunk['table_caption'] = result.payload.get(
                        'table_caption', [])

                results.append(chunk)

            # Post-process: Filter by multiple companies if specified
            # (Qdrant doesn't support OR conditions easily, so we filter after retrieval)
            if companies and len(companies) > 0:
                target_companies_lower = [c.lower() if isinstance(
                    c, str) else c for c in companies]
                results = [
                    r for r in results
                    if r['metadata'].get('company', '').lower() in target_companies_lower
                ]

            # Apply balancing if multi-company query
            if len(target_companies) > 1:
                results = self._normalize_scores_per_company(
                    results, target_companies)
                return self._balance_results(results, target_companies, top_k)
            else:
                # Single company or no company filter - just sort and return
                results.sort(key=lambda x: x['score'], reverse=True)
                return results[:top_k]

        except Exception as e:
            logger.error(
                f"Error searching collection {DOCUMENT_CHUNKS_COLLECTION}: {e}")
            return []

    def hybrid_search(
        self,
        query_vector: List[float],
        query_text: str,
        user_id: str,
        top_k: int = 10,
        alpha: float = 0.7,
        company: Optional[str] = None,
        companies: Optional[List[str]] = None,
        year: Optional[int] = None,
        year_range: Optional[Tuple[int, int]] = None,
        # NEW FILTERS
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
        exchange: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Perform hybrid search (semantic + BM25 keyword).

        Args:
            query_vector: Query embedding vector
            query_text: Query text for keyword search
            user_id: User UUID string (REQUIRED - security filter)
            top_k: Number of results
            alpha: Weight for semantic search (0=keyword only, 1=semantic only)
            company: Filter by single company (optional, ignored if companies is provided)
            companies: Filter by multiple companies (optional, takes priority over company)
            year: Filter by single fiscal year (optional)
            year_range: Filter by fiscal year range (min, max) (optional)
            document_type: Filter by document type (optional)
            document_types: Filter by multiple document types (optional)
            document_category: Filter by document category (optional)
            fiscal_quarter: Filter by fiscal quarter (optional)
            sector: Filter by company sector (optional)
            sectors: Filter by multiple sectors (optional)
            industry: Filter by company industry (optional)
            has_financial_statements: Filter by financial statements presence (optional)
            has_mda: Filter by MD&A presence (optional)
            has_risk_factors: Filter by risk factors presence (optional)
            period_type: Filter by period type (optional)
            reporting_standard: Filter by reporting standard (optional)
            country: Filter by company country (optional)
            exchange: Filter by company exchange (optional)

        Returns:
            List of similar chunks with combined scores
        """
        if not user_id:
            raise ValueError("user_id is required for hybrid_search")

        # Determine target companies for balancing
        target_companies = []
        if companies and len(companies) > 0:
            target_companies = [c.lower() if isinstance(
                c, str) else c for c in companies]
        elif company:
            target_companies = [company.lower() if isinstance(
                company, str) else company]

        # Perform semantic search first
        semantic_results = self.search(
            query_vector=query_vector,
            user_id=user_id,
            # Get more for hybrid scoring
            top_k=top_k * 3 if len(target_companies) > 1 else top_k,
            company=company,
            companies=companies,
            year=year,
            year_range=year_range,
            document_type=document_type,
            document_types=document_types,
            document_category=document_category,
            fiscal_quarter=fiscal_quarter,
            sector=sector,
            sectors=sectors,
            industry=industry,
            has_financial_statements=has_financial_statements,
            has_mda=has_mda,
            has_risk_factors=has_risk_factors,
            period_type=period_type,
            reporting_standard=reporting_standard,
            country=country,
            exchange=exchange
        )

        if not query_text:
            # No keyword search - return semantic results (already balanced if multi-company)
            return semantic_results[:top_k]

        # Calculate keyword scores and combine with semantic scores
        scored_results = []
        for chunk in semantic_results:
            # Get semantic score
            semantic_score = chunk['score']

            # Calculate keyword relevance score
            keyword_score = self.keyword_searcher.calculate_keyword_relevance(
                query=query_text,
                content=chunk['content'],
                use_phrases=True
            )

            # Normalize semantic score to 0-1 range if needed
            normalized_semantic = max(0.0, min(
                1.0, (semantic_score + 1) / 2)) if semantic_score < 0 else semantic_score

            # Combine scores with alpha weighting
            combined_score = (
                alpha * normalized_semantic +
                (1 - alpha) * keyword_score
            )

            chunk['score'] = combined_score
            chunk['semantic_score'] = normalized_semantic
            chunk['keyword_score'] = keyword_score
            scored_results.append(chunk)

        # Apply balancing if multi-company query
        if len(target_companies) > 1:
            # Normalize scores per company after keyword scoring
            scored_results = self._normalize_scores_per_company(
                scored_results, target_companies)
            return self._balance_results(scored_results, target_companies, top_k)
        else:
            # Single company or no company filter - just sort and return
            scored_results.sort(key=lambda x: x['score'], reverse=True)
            return scored_results[:top_k]

    def _build_query_filter(
        self,
        user_id: str,
        company: Optional[str] = None,
        companies: Optional[List[str]] = None,
        year: Optional[int] = None,
        year_range: Optional[Tuple[int, int]] = None,
        # NEW FILTERS
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
    ) -> Filter:
        """
        Build Qdrant query filter from parameters.

        Always includes user_id filter for security.
        """
        filter_conditions = [
            # ALWAYS include user_id filter (security)
            FieldCondition(key="user_id", match=MatchValue(value=user_id))
        ]

        # Temporal filters (clean: use fiscal_year, not year)
        if year_range:
            filter_conditions.append(FieldCondition(
                key="fiscal_year", range=Range(gte=year_range[0], lte=year_range[1])))
        elif year is not None:
            filter_conditions.append(FieldCondition(
                key="fiscal_year", match=MatchValue(value=year)))

        # Company filters
        # Priority: companies > company
        # - If companies is provided (even with 1 item), don't filter at Qdrant level
        #   (filter in post-processing to support multi-company balancing)
        # - If only company is provided, filter at Qdrant level for efficiency
        # Note: Qdrant's Filter doesn't support OR conditions easily, so multi-company
        # filtering is done in post-processing
        if company and not (companies and len(companies) > 0):
            # Single company filter at Qdrant level (efficient)
            filter_conditions.append(FieldCondition(
                key="company", match=MatchValue(value=company.lower() if isinstance(company, str) else company)))

        # NEW: Document type filtering
        if document_type and not (document_types and len(document_types) > 0):
            filter_conditions.append(FieldCondition(
                key="document_type", match=MatchValue(value=document_type)))

        if document_category:
            filter_conditions.append(FieldCondition(
                key="document_category", match=MatchValue(value=document_category)))

        # NEW: Fiscal quarter filtering
        if fiscal_quarter is not None:
            filter_conditions.append(FieldCondition(
                key="fiscal_quarter", match=MatchValue(value=fiscal_quarter)))

        # NEW: Sector/industry filtering
        if sector and not (sectors and len(sectors) > 0):
            filter_conditions.append(FieldCondition(
                key="company_sector", match=MatchValue(value=sector)))

        if industry:
            filter_conditions.append(FieldCondition(
                key="company_industry", match=MatchValue(value=industry)))

        # NEW: Content-based filtering
        if has_financial_statements is not None:
            filter_conditions.append(FieldCondition(
                key="has_financial_statements", match=MatchValue(value=has_financial_statements)))

        if has_mda is not None:
            filter_conditions.append(FieldCondition(
                key="has_mda", match=MatchValue(value=has_mda)))

        if has_risk_factors is not None:
            filter_conditions.append(FieldCondition(
                key="has_risk_factors", match=MatchValue(value=has_risk_factors)))

        # NEW: Period type filtering
        if period_type:
            filter_conditions.append(FieldCondition(
                key="period_type", match=MatchValue(value=period_type)))

        # NEW: Reporting standard filtering
        if reporting_standard:
            filter_conditions.append(FieldCondition(
                key="reporting_standard", match=MatchValue(value=reporting_standard)))

        # NEW: Geographic filtering
        if country:
            filter_conditions.append(FieldCondition(
                key="company_country", match=MatchValue(value=country)))

        if exchange:
            filter_conditions.append(FieldCondition(
                key="company_exchange", match=MatchValue(value=exchange)))

        # Existing filters
        if chunk_type:
            filter_conditions.append(FieldCondition(
                key="chunk_type", match=MatchValue(value=chunk_type)))

        if has_table is not None:
            filter_conditions.append(FieldCondition(
                key="has_table", match=MatchValue(value=has_table)))

        return Filter(must=filter_conditions)

    def delete_document_chunks(self, document_id: str, user_id: str) -> int:
        """
        Delete all chunks for a specific document from Qdrant.

        Args:
            document_id: Document UUID string
            user_id: User UUID string (required for security)

        Returns:
            Number of chunks deleted
        """
        if not user_id:
            raise ValueError("user_id is required for delete_document_chunks")

        try:
            # Build filter to find all chunks for this document and user
            filter_conditions = [
                FieldCondition(key="user_id", match=MatchValue(value=user_id)),
                FieldCondition(key="document_id",
                               match=MatchValue(value=document_id))
            ]
            delete_filter = Filter(must=filter_conditions)

            # Use scroll to find all matching points (handle pagination)
            all_point_ids = []
            offset = None
            limit = 1000

            while True:
                scroll_result = self.client.scroll(
                    collection_name=DOCUMENT_CHUNKS_COLLECTION,
                    scroll_filter=delete_filter,
                    limit=limit,
                    offset=offset,
                    with_payload=False,
                    with_vectors=False
                )

                points_batch = scroll_result[0]
                if not points_batch:
                    break

                all_point_ids.extend([point.id for point in points_batch])
                offset = scroll_result[1]  # Next page offset

                # If we got fewer points than the limit, we're done
                if len(points_batch) < limit:
                    break

            if not all_point_ids:
                logger.info(f"No chunks found for document {document_id}")
                return 0

            # Delete all points by ID
            self.client.delete(
                collection_name=DOCUMENT_CHUNKS_COLLECTION,
                points_selector=all_point_ids
            )

            deleted_count = len(all_point_ids)
            logger.info(
                f"Deleted {deleted_count} chunks for document {document_id} (user {user_id})")
            return deleted_count

        except Exception as e:
            logger.error(
                f"Error deleting chunks for document {document_id}: {e}", exc_info=True)
            raise

    def _normalize_scores_per_company(
        self,
        results: List[Dict[str, Any]],
        target_companies: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Normalize scores within each company's results.

        Used for multi-company queries to ensure fair comparison.
        """
        # Group results by company
        results_by_company = {}
        target_companies_lower = [c.lower() if isinstance(
            c, str) else c for c in target_companies]

        for company in target_companies_lower:
            results_by_company[company] = [
                r for r in results
                if r['metadata'].get('company', '').lower() == company
            ]

        # Normalize scores within each company
        normalized_results = []
        for company, company_results in results_by_company.items():
            if not company_results:
                continue

            scores = [r['score'] for r in company_results]
            if scores:
                mean_score = sum(scores) / len(scores)
                std_score = (
                    sum((s - mean_score) ** 2 for s in scores) / len(scores)) ** 0.5

                if std_score > 0:
                    # Z-score normalization per company
                    for result in company_results:
                        result['normalized_score'] = (
                            result['score'] - mean_score) / std_score
                        result['score'] = result.get(
                            'normalized_score', result['score'])
                else:
                    # All scores same - set to 0
                    for result in company_results:
                        result['score'] = 0.0

            normalized_results.extend(company_results)

        return normalized_results

    def _balance_results(
        self,
        results: List[Dict[str, Any]],
        target_companies: List[str],
        top_k: int
    ) -> List[Dict[str, Any]]:
        """
        Balance results across multiple companies to ensure equal representation.

        Used for comparative queries (e.g., "Compare Apple vs Microsoft revenue").
        Ensures fair representation from each company.
        """
        # Group results by company (normalize for case-insensitive matching)
        results_by_company = {}
        target_companies_lower = [c.lower() if isinstance(
            c, str) else c for c in target_companies]

        for company in target_companies_lower:
            results_by_company[company] = [
                r for r in results
                if r['metadata'].get('company', '').lower() == company
            ]
            # Ensure sorted by score
            results_by_company[company].sort(
                key=lambda x: x['score'], reverse=True)

        # Check if we have results from all companies
        company_counts = {
            c: len(results_by_company[c]) for c in target_companies_lower}
        if any(count == 0 for count in company_counts.values()):
            missing = [c for c, count in company_counts.items() if count == 0]
            logger.warning(
                f"No results found for companies: {missing}. Available: {company_counts}")

        # Balanced retrieval: ensure equal representation from each company
        # Use round-robin interleaving to maintain balance while respecting scores
        balanced_results = []
        per_company_k = max(1, top_k // len(target_companies_lower))
        remainder = top_k % len(target_companies_lower)

        # Track how many we've taken from each company
        taken_count = {company: 0 for company in target_companies_lower}

        # Round-robin: take best available from each company in rotation
        max_available = max(
            (len(results_by_company[c]) for c in target_companies_lower),
            default=0
        )

        for round_idx in range(max_available):
            # In each round, try to take one from each company
            for company in target_companies_lower:
                if len(balanced_results) >= top_k:
                    break

                # Check if this company has results at this index
                if round_idx < len(results_by_company[company]):
                    # Only take if we haven't exceeded per_company_k (or remainder)
                    if taken_count[company] < per_company_k:
                        balanced_results.append(
                            results_by_company[company][round_idx])
                        taken_count[company] += 1
                    elif remainder > 0 and taken_count[company] == per_company_k:
                        # Distribute remainder
                        balanced_results.append(
                            results_by_company[company][round_idx])
                        taken_count[company] += 1
                        remainder -= 1
            if len(balanced_results) >= top_k:
                break

        # Do not re-sort by score - this breaks the balance.
        # Round-robin ensures balanced representation while respecting score order within each company.
        return balanced_results[:top_k]


def get_qdrant_client(host: str = None, port: int = None) -> QdrantClient:
    """
    Get singleton QdrantClient instance.

    Creates the instance on first call and reuses it for all subsequent calls.
    This prevents redundant connection initialization and reduces memory usage.

    Args:
        host: Optional Qdrant host (uses settings if None)
        port: Optional Qdrant port (uses settings if None)

    Returns:
        Singleton QdrantClient instance
    """
    global _qdrant_client_instance
    if _qdrant_client_instance is None:
        with _qdrant_client_lock:
            if _qdrant_client_instance is None:
                _qdrant_client_instance = QdrantClient(host=host, port=port)
                logger.debug("QdrantClient singleton instance created")

                # Ensure collections exist after client creation
                _ensure_collections_exist(_qdrant_client_instance)

    return _qdrant_client_instance


def _ensure_collections_exist(client: QdrantClient) -> None:
    """Ensure required collections exist with correct dimensions."""
    try:
        collections = client.client.get_collections()
        collection_names = [c.name for c in collections.collections]

        # Check if document_chunks collection exists
        if DOCUMENT_CHUNKS_COLLECTION not in collection_names:
            logger.info(f"Creating {DOCUMENT_CHUNKS_COLLECTION} collection...")
            # Get embedding dimensions from current embedder (2048 for Voyage AI)
            from backend.core.ai.embedding.manager import get_embedding_manager
            embedding_manager = get_embedding_manager()
            embedding_dimensions = embedding_manager.get_embedding_dimensions()

            client.client.create_collection(
                collection_name=DOCUMENT_CHUNKS_COLLECTION,
                vectors_config={
                    "size": embedding_dimensions,
                    "distance": "Cosine"
                }
            )
            logger.info(f"Created {DOCUMENT_CHUNKS_COLLECTION} collection with {embedding_dimensions} dimensions")
        else:
            logger.debug(f"{DOCUMENT_CHUNKS_COLLECTION} collection already exists")

    except Exception as e:
        logger.error(f"Error ensuring collections exist: {e}")
        # Don't raise - allow graceful degradation
