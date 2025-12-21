"""Qdrant indexing operations."""
import logging
import uuid
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class Chunker:
    """Chunker for content_list elements with semantic boundaries."""

    MAX_CHUNK_SIZE = 2000  # Maximum characters per chunk (safety limit)

    def chunk_elements(
        self,
        elements: List[Dict[str, Any]],
        user_id: str,
        document_id: str,
        metadata: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """Chunk content_list elements into semantic chunks."""
        if not elements:
            return []

        chunks = []
        current_chunk = []
        current_page = None
        chunk_id = 0
        metadata = metadata or {}

        for i, elem in enumerate(elements):
            page_idx = elem.get('page_idx', 0)
            elem_type = elem.get('type', '').lower()

            # Extract text based on element type
            text = self._extract_text_from_element(elem)

            if not text:
                continue

            # Start new chunk if new page or heading
            should_start_new = False
            if current_page is None:
                current_page = page_idx
            elif page_idx != current_page:
                should_start_new = True
                current_page = page_idx

            # Start new chunk on headings (text_level <= 2)
            text_level = elem.get('text_level', 999)
            if text_level <= 2 and current_chunk:
                should_start_new = True

            # Check chunk size limit (only if not already starting new chunk)
            if not should_start_new and current_chunk:
                # Calculate current chunk size using helper method
                current_chunk_text = ' '.join(
                    self._extract_text_from_element(e)
                    for e in current_chunk
                )
                # If adding this element would exceed limit, start new chunk
                if len(current_chunk_text) + len(text) > self.MAX_CHUNK_SIZE:
                    should_start_new = True

            if should_start_new and current_chunk:
                chunk = self._create_chunk(
                    current_chunk, chunk_id, user_id, document_id, metadata
                )
                chunks.append(chunk)
                chunk_id += 1
                current_chunk = []

            current_chunk.append(elem)

        # Finalize last chunk
        if current_chunk:
            chunk = self._create_chunk(
                current_chunk, chunk_id, user_id, document_id, metadata
            )
            chunks.append(chunk)

        logger.info(
            f"Created {len(chunks)} chunks from {len(elements)} elements")
        return chunks

    def _extract_text_from_element(self, elem: Dict[str, Any]) -> str:
        """Extract text from element, handling VLM-specific block types."""
        elem_type = elem.get('type', '').lower()

        # Code blocks may have nested structure (code_body, code_caption)
        if elem_type == 'code':
            # Check for nested blocks structure
            blocks = elem.get('blocks', [])
            if blocks:
                # Extract text from nested blocks (code_body, code_caption)
                texts = []
                for block in blocks:
                    block_text = block.get('text', '').strip()
                    if block_text:
                        texts.append(block_text)
                if texts:
                    return '\n'.join(texts)
            # Fallback to direct text field
            return elem.get('text', '').strip() or elem.get('content', '').strip()

        # List blocks may have nested items
        elif elem_type == 'list':
            # Check for nested blocks structure
            blocks = elem.get('blocks', [])
            if blocks:
                # Extract text from nested list items
                texts = []
                for block in blocks:
                    block_text = block.get('text', '').strip()
                    if block_text:
                        texts.append(block_text)
                if texts:
                    return '\n'.join(texts)
            # Fallback to direct text field
            return elem.get('text', '').strip() or elem.get('content', '').strip()

        # Standard text extraction (MinerU uses 'text' field, not 'content')
        return elem.get('text', '').strip() or elem.get('content', '').strip()

    def _create_chunk(
        self,
        elements: List[Dict[str, Any]],
        chunk_id: int,
        user_id: str,
        document_id: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a chunk dict from elements."""
        # Extract text using helper method (handles code/list blocks)
        texts = []
        for elem in elements:
            text = self._extract_text_from_element(elem)
            if text:
                texts.append(text)
        content = ' '.join(texts)

        first_elem = elements[0]
        page_idx = first_elem.get('page_idx', 0)
        page_indices = sorted(set(e.get('page_idx', 0) for e in elements))

        # Detect chunk type (VLM-specific block types)
        has_table = any(elem.get('type', '').lower() ==
                        'table' for elem in elements)
        has_code = any(elem.get('type', '').lower()
                       == 'code' for elem in elements)
        has_list = any(elem.get('type', '').lower()
                       == 'list' for elem in elements)
        text_level = first_elem.get('text_level', 999)

        # Priority: heading > table > code > list > paragraph
        if text_level <= 2:
            chunk_type = 'heading'
        elif has_table:
            chunk_type = 'table'
        elif has_code:
            chunk_type = 'code'
        elif has_list:
            chunk_type = 'list'
        else:
            chunk_type = 'paragraph'

        return {
            'chunk_id': f"{document_id}_chunk_{chunk_id}",
            'user_id': user_id,
            'document_id': document_id,
            'content': content,
            'chunk_type': chunk_type,
            'has_table': has_table,
            'page_indices': page_indices,
            'metadata': {
                'user_id': user_id,
                'document_id': document_id,
                'page_idx': page_indices[0] if page_indices else 0,
                'chunk_type': chunk_type,
                'has_table': has_table,
                # Core metadata (use standard field names from metadata schema)
                'company': metadata.get('company_name') or metadata.get('company'),
                'fiscal_year': metadata.get('fiscal_year'),
                'fiscal_quarter': metadata.get('fiscal_quarter'),
                'document_type': metadata.get('document_type'),
                'document_category': metadata.get('document_category'),
                'fiscal_period_end': metadata.get('fiscal_period_end'),
                'period_type': metadata.get('period_type'),
                # Company info
                'company_ticker': metadata.get('company_ticker'),
                'company_sector': metadata.get('company_sector'),
                'company_industry': metadata.get('company_industry'),
                'company_country': metadata.get('company_country'),
                'company_exchange': metadata.get('company_exchange'),
                # Content flags
                'has_financial_statements': metadata.get('has_financial_statements'),
                'has_mda': metadata.get('has_mda'),
                'has_risk_factors': metadata.get('has_risk_factors'),
                'has_compensation': metadata.get('has_compensation'),
                'has_governance': metadata.get('has_governance'),
                # Other
                'filename': metadata.get('filename'),
                'file_source': f"{document_id}_content_list.json",
                'reporting_standard': metadata.get('reporting_standard'),
                'currency': metadata.get('currency'),
            }
        }


def chunk_to_point(chunk: Dict[str, Any]) -> Dict[str, Any]:
    """Convert chunk dict to Qdrant point format."""
    # Generate UUID for point ID (Qdrant requires UUID or integer)
    point_id = str(uuid.uuid4())

    return {
        'id': point_id,
        'vector': chunk['embedding'],
        'payload': {
            # Keep original chunk_id in payload for reference
            'chunk_id': chunk['chunk_id'],
            'user_id': chunk['user_id'],
            'document_id': chunk['document_id'],
            'content': chunk['content'],
            'chunk_type': chunk.get('chunk_type', 'paragraph'),
            'has_table': chunk.get('has_table', False),
            'page_indices': chunk['page_indices'],
            **chunk['metadata']
        }
    }


def index_document(
    user_id: str,
    document_id: str,
    content_list: List[Dict[str, Any]],
    metadata: Dict[str, Any],
    voyage_api_key: str,
    voyage_model: str,
    qdrant_url: str,
    qdrant_api_key: str,
    collection_name: str
) -> int:
    """Index document content into Qdrant."""
    try:
        import voyageai
        from qdrant_client import QdrantClient
        from qdrant_client.models import PointStruct

        logger.info(f"Indexing document {document_id} for user {user_id}")

        # Chunk elements
        chunker = Chunker()
        chunks = chunker.chunk_elements(
            elements=content_list,
            user_id=user_id,
            document_id=document_id,
            metadata=metadata or {}
        )

        # Filter empty chunks
        valid_chunks = [chunk for chunk in chunks if chunk.get(
            'content', '').strip()]

        if not valid_chunks:
            logger.warning(f"No valid chunks for document {document_id}")
            return 0

        logger.info(f"Generated {len(valid_chunks)} valid chunks")

        # Generate embeddings in batches
        voyage_client = voyageai.Client(api_key=voyage_api_key)
        embedded_chunks = []
        batch_size = 10

        for i in range(0, len(valid_chunks), batch_size):
            batch = valid_chunks[i:i + batch_size]
            texts = [chunk['content'] for chunk in batch]

            result = voyage_client.embed(
                texts,
                model=voyage_model,
                input_type="document"
            )

            for j, chunk in enumerate(batch):
                chunk['embedding'] = result.embeddings[j]
                embedded_chunks.append(chunk)

            logger.debug(
                f"Embedded batch {i // batch_size + 1}/{(len(valid_chunks) + batch_size - 1) // batch_size}")

        logger.info(f"Generated embeddings for {len(embedded_chunks)} chunks")

        # Convert to Qdrant points
        points = []
        for chunk in embedded_chunks:
            try:
                point_dict = chunk_to_point(chunk)
                point = PointStruct(**point_dict)
                points.append(point)
            except Exception as e:
                logger.error(
                    f"Error converting chunk {chunk.get('chunk_id')}: {e}")
                continue

        # Upsert to Qdrant
        qdrant_client = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
        qdrant_client.upsert(
            collection_name=collection_name,
            points=points
        )

        logger.info(f"Indexed {len(points)} chunks for document {document_id}")
        return len(points)

    except Exception as e:
        logger.error(
            f"Error indexing document {document_id}: {e}", exc_info=True)
        return 0
