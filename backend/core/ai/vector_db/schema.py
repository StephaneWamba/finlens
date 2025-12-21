"""
Vector database schema definitions
"""

from typing import Dict, Any, Optional


def create_collection_schema(embedding_dimensions: Optional[int] = None) -> Dict[str, Any]:
    """
    Create Qdrant collection schema.

    Args:
        embedding_dimensions: Optional embedding dimensions. If None, uses current embedder.

    Returns:
        Collection configuration dictionary
    """
    if embedding_dimensions is None:
        # Get dimensions from current embedder
        from backend.core.ai.embedding.manager import get_embedding_manager
        embedding_manager = get_embedding_manager()
        embedding_dimensions = embedding_manager.get_embedding_dimensions()

    return {
        "vectors": {
            "size": embedding_dimensions,
            "distance": "Cosine"
        }
    }


def chunk_to_point(chunk: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert chunk to Qdrant point format.

    Args:
        chunk: Chunk dictionary with embedding and metadata

    Returns:
        Qdrant point dictionary
    """
    # Generate unsigned integer ID from chunk_id hash
    # Qdrant requires unsigned integers (0 to 2^64-1) or UUIDs
    chunk_id_hash = hash(chunk['chunk_id'])
    # Convert to unsigned 64-bit integer by masking with 0xFFFFFFFFFFFFFFFF
    # This ensures the value is always positive and within valid range
    point_id = chunk_id_hash & 0xFFFFFFFFFFFFFFFF

    metadata = chunk.get('metadata', {})

    return {
        "id": point_id,
        "vector": chunk['embedding'],
        "payload": {
            # REQUIRED (clean: only from metadata)
            "user_id": metadata.get('user_id'),
            "document_id": metadata.get('document_id'),

            # Core chunk info
            "chunk_id": chunk['chunk_id'],
            "chunk_type": chunk['chunk_type'],
            "content": chunk['content'],
            "page_idx": metadata.get('page_idx'),
            "has_table": chunk.get('has_table', False),

            # Company metadata (REQUIRED for filtering)
            "company": metadata.get('company'),  # Company name (normalized)
            "company_ticker": metadata.get('company_ticker'),
            "company_sector": metadata.get('company_sector'),
            "company_industry": metadata.get('company_industry'),
            "company_country": metadata.get('company_country'),
            "company_exchange": metadata.get('company_exchange'),

            # Temporal metadata (clean: use primary field names only)
            "fiscal_year": metadata.get('fiscal_year'),  # Primary field
            "fiscal_quarter": metadata.get('fiscal_quarter'),
            "fiscal_period_end": metadata.get('fiscal_period_end'),
            "period_type": metadata.get('period_type'),

            # Document type metadata
            "document_type": metadata.get('document_type'),
            "document_category": metadata.get('document_category'),
            "filing_type": metadata.get('filing_type'),

            # Content flags
            "has_financial_statements": metadata.get('has_financial_statements', False),
            "has_mda": metadata.get('has_mda', False),
            "has_risk_factors": metadata.get('has_risk_factors', False),
            "has_compensation": metadata.get('has_compensation', False),
            "has_governance": metadata.get('has_governance', False),

            # Other metadata
            "page_range": metadata.get('page_range', []),
            "char_count": metadata.get('char_count', 0),
            "chunking_strategy": metadata.get('chunking_strategy', 'unknown'),
            "reporting_standard": metadata.get('reporting_standard'),
            "currency": metadata.get('currency'),

            # Table-specific
            "table_body": chunk.get('table_body', ''),
            "table_caption": chunk.get('table_caption', []),
        }
    }
