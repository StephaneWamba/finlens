# Document Chunking Strategy

Semantic chunking of parsed documents with boundary detection and type classification.

## MinerU Overview

MinerU is a GPU-accelerated PDF parsing tool that extracts structured content from PDF documents using Vision Language Models (VLM). It converts PDF pages into structured JSON elements with text, layout, and semantic information.

### What MinerU Does

- **OCR Processing**: Extracts text from PDF pages (including scanned documents)
- **Layout Analysis**: Identifies document structure (headings, paragraphs, tables, lists)
- **Element Classification**: Categorizes content by type (text, table, code, list)
- **Semantic Markup**: Adds metadata (page index, text level for headings, element type)

### MinerU Backends

| Backend           | Description                                      | Use Case             |
| ----------------- | ------------------------------------------------ | -------------------- |
| `vlm-vllm-engine` | VLM with vLLM inference engine (GPU-accelerated) | Production (default) |
| `auto`            | Automatic pipeline backend                       | Fallback             |

### Output Format

MinerU generates `content_list.json` containing array of elements:

```json
[
  {
    "type": "paragraph",
    "text": "Revenue increased by 15%...",
    "page_idx": 1,
    "text_level": 3
  },
  {
    "type": "heading",
    "text": "Financial Statements",
    "page_idx": 2,
    "text_level": 1
  },
  {
    "type": "table",
    "text": "Revenue: $100M\nIncome: $50M",
    "page_idx": 2,
    "text_level": 999
  }
]
```

### Element Fields

| Field        | Type       | Description                                                   |
| ------------ | ---------- | ------------------------------------------------------------- |
| `type`       | str        | Element type: `paragraph`, `heading`, `table`, `code`, `list` |
| `text`       | str        | Extracted text content                                        |
| `page_idx`   | int        | Page number (0-indexed)                                       |
| `text_level` | int        | Heading level (1-6 for headings, 999 for non-headings)        |
| `blocks`     | List[dict] | Nested structure for code/list elements                       |

### Integration

MinerU is executed via CLI on the GPU server:

```bash
mineru -p <pdf_path> -o <output_dir> --backend vlm-vllm-engine
```

Output file location depends on backend:

- VLM backend: `{output_dir}/{filename}/{filename}_content_list.json` or `{output_dir}/{filename}/vlm/{filename}_content_list.json`
- Pipeline backend: `{output_dir}/{filename}/auto/{filename}_content_list.json`

The system waits for file generation (adaptive timeout based on PDF size) and then processes the `content_list.json` for chunking.

## Chunking Algorithm

## Chunking Algorithm

Chunks are created from MinerU OCR output (`content_list.json`). Elements are grouped into semantic chunks based on boundaries.

### Boundary Detection

New chunk is started when:

1. **Page break**: `page_idx` changes
2. **Heading**: `text_level <= 2` (h1, h2 headings)
3. **Size limit**: Current chunk + new element exceeds MAX_CHUNK_SIZE (2000 chars)

### Chunk Size

- **MAX_CHUNK_SIZE**: 2000 characters (hard limit)
- Size calculated from concatenated text of all elements in chunk
- If adding element would exceed limit, current chunk is finalized and new chunk starts

## Element Text Extraction

Text extraction handles different MinerU element types:

| Element Type | Extraction Method                                                                    |
| ------------ | ------------------------------------------------------------------------------------ |
| `code`       | Extracts from nested `blocks` array (code_body, code_caption) or direct `text` field |
| `list`       | Extracts from nested `blocks` array (list items) or direct `text` field              |
| `table`      | Extracts from `text` field                                                           |
| `paragraph`  | Extracts from `text` field                                                           |

Fallback: Uses `content` field if `text` is empty.

## Chunk Type Classification

Chunk type determined by priority:

1. **heading**: If any element has `text_level <= 2`
2. **table**: If any element has `type == 'table'`
3. **code**: If any element has `type == 'code'`
4. **list**: If any element has `type == 'list'`
5. **paragraph**: Default for all other chunks

## Chunk Structure

```python
{
    'chunk_id': f"{document_id}_chunk_{chunk_id}",
    'content': str,  # Concatenated text from all elements
    'chunk_type': str,  # 'heading', 'table', 'code', 'list', 'paragraph'
    'page_idx': int,  # First element's page index
    'page_indices': List[int],  # All page indices in chunk (if spans pages)
    'has_table': bool,  # True if chunk contains table elements
    'metadata': {
        'user_id': str,
        'document_id': str,
        'company': str,
        'fiscal_year': int,
        # ... other document metadata
    }
}
```

## Chunking Example

Input elements:

```
[
    {type: 'paragraph', text: 'Revenue increased...', page_idx: 1, text_level: 3},
    {type: 'paragraph', text: 'Net income was...', page_idx: 1, text_level: 3},
    {type: 'heading', text: 'Financial Statements', page_idx: 2, text_level: 1},
    {type: 'table', text: 'Revenue: $100M...', page_idx: 2, text_level: 999}
]
```

Output chunks:

```
Chunk 1:
  - Elements: [paragraph1, paragraph2]
  - Type: 'paragraph'
  - Page: 1
  - Content: 'Revenue increased... Net income was...'

Chunk 2:
  - Elements: [heading]
  - Type: 'heading'
  - Page: 2
  - Content: 'Financial Statements'

Chunk 3:
  - Elements: [table]
  - Type: 'table'
  - Page: 2
  - Content: 'Revenue: $100M...'
```

## Implementation Details

### Chunker Class

Location: `vast-ai-server/indexer.py`

```python
class Chunker:
    MAX_CHUNK_SIZE = 2000

    def chunk_elements(
        self,
        elements: List[Dict[str, Any]],
        user_id: str,
        document_id: str,
        metadata: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]
```

### Processing Flow

1. Iterate through elements sequentially
2. Extract text from each element (handles nested structures)
3. Check boundaries (page, heading, size)
4. Group elements into chunks
5. Classify chunk type
6. Create chunk dictionary with metadata

### Edge Cases

- **Empty elements**: Skipped (no text extracted)
- **Multi-page chunks**: `page_indices` contains all page numbers
- **Nested structures**: Code/list blocks with nested `blocks` array are flattened
- **Size limit at boundary**: If element would exceed limit at page/heading boundary, boundary takes priority (new chunk starts)
