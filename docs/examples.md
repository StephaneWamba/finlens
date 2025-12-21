# Examples & Use Cases

Examples of document processing and query responses. Users upload their own financial documents and query them using natural language.

## Document Types Supported

| Document Type         | Description                           | Typical Length |
| --------------------- | ------------------------------------- | -------------- |
| **10-K Reports**      | Annual reports filed with SEC         | 200-500 pages  |
| **10-Q Reports**      | Quarterly financial reports           | 100-300 pages  |
| **10-K/A, 10-Q/A**    | Amended filings                       | 200-500 pages  |
| **8-K Reports**       | Current event reports                 | 10-50 pages    |
| **Annual Reports**    | Company annual shareholder reports    | 150-400 pages  |
| **Quarterly Reports** | Quarterly shareholder reports         | 100-300 pages  |
| **Earnings Releases** | Quarterly earnings announcements      | 20-100 pages   |
| **Proxy Statements**  | Executive compensation and governance | 100-200 pages  |

## Example Queries

The following examples demonstrate queries users can perform on their uploaded documents.

### Revenue Analysis

**Query (on user's uploaded documents):**

```
What are Apple's revenue trends for the last 3 years?
```

**System Process:**

1. Retrieval Agent identifies relevant documents (Apple 10-K reports 2022-2024)
2. Analysis Agent extracts revenue figures and calculates growth rates
3. Generation Agent synthesizes trend analysis with citations

**Response:**

```
Apple's revenue has shown consistent growth over the past 3 years:
- 2022: $394.3 billion (8.1% increase)
- 2023: $383.3 billion (-2.8% decrease)
- 2024: $394.3 billion (2.8% increase)

The decline in 2023 was primarily due to supply chain constraints,
with recovery in 2024 driven by strong iPhone and Services growth.

Sources:
- apple_10k_2024.pdf, page 45
- apple_10k_2023.pdf, page 42
```

### Cross-Company Comparison

**Query (requires user to have uploaded documents from multiple companies):**

```
Compare Tesla's R&D spending vs competitors in the automotive sector
```

**System Process:**

1. Retrieval Agent finds Tesla documents and identifies automotive competitors
2. Analysis Agent extracts R&D figures from multiple companies
3. Generation Agent creates comparative analysis with percentages

**Response:**

```
Tesla's R&D spending comparison (2024):
- Tesla: $3.0 billion (3.2% of revenue)
- Ford: $7.8 billion (4.1% of revenue)
- GM: $9.1 billion (4.5% of revenue)

Tesla maintains lower absolute R&D spending but focuses on
software and battery technology innovation.

Sources:
- tesla_10k_2024.pdf, page 78
- ford_annual_2024.pdf, page 92
```

### Risk Assessment

**Query:**

```
What are the main risk factors mentioned in Nvidia's 2024 annual report?
```

**System Process:**

1. Retrieval Agent locates risk factors section in Nvidia 10-K
2. Analysis Agent categorizes risks by type (operational, financial, regulatory)
3. Generation Agent summarizes top risks with context

**Response:**

```
Primary risk factors identified in Nvidia's 2024 annual report:

1. **Supply Chain Dependencies**: Heavy reliance on TSMC for
   advanced chip manufacturing
2. **Regulatory Changes**: Export restrictions affecting China market
3. **Competition**: Increased competition in AI chip market
4. **Cyclical Demand**: GPU demand fluctuations based on crypto and AI trends

Sources:
- nvidia_10k_2024.pdf, pages 12-28 (Risk Factors section)
```

### Financial Statement Extraction

**Query:**

```
Show me Microsoft's operating income for the last 5 years
```

**System Process:**

1. Retrieval Agent finds Microsoft 10-K reports 2020-2024
2. Analysis Agent extracts operating income from income statements
3. Generation Agent formats data in table with trend analysis

**Response:**

```
Microsoft Operating Income (2019-2024):

| Year | Operating Income | Growth |
|------|------------------|--------|
| 2020 | $52.7B | - |
| 2021 | $69.9B | +32.6% |
| 2022 | $83.4B | +19.3% |
| 2023 | $88.5B | +6.1% |
| 2024 | $96.9B | +9.5% |

Strong consistent growth driven by cloud services (Azure) and
productivity software (Office 365).

Sources:
- microsoft_10k_2024.pdf, page 34
- microsoft_10k_2023.pdf, page 32
```

## Complex Query Handling

The system processes complex analytical queries through a 3-agent workflow:

1. **Query Decomposition**: Breaks down multi-part questions, retrieves conversation context, performs hybrid search
2. **Multi-Document Analysis**: Analyzes chunks from multiple documents, extracts metrics, performs comparisons
3. **Synthesis**: Generates structured responses with citations and data visualizations

## Complex Multi-Document Queries

### Trend Analysis Across Companies

**Query:**

```
How has cloud revenue growth compared between Amazon, Microsoft, and Google over the past 3 years?
```

**System Process:**

1. Retrieval Agent identifies cloud segments in all three companies' filings
2. Analysis Agent extracts AWS, Azure, and Google Cloud revenue figures
3. Generation Agent creates comparative growth analysis

**Response:**

```
Cloud Revenue Growth Comparison (2022-2024):

**Amazon Web Services (AWS):**
- 2022: $80.1B (+29% YoY)
- 2023: $90.8B (+13% YoY)
- 2024: $97.4B (+7% YoY)

**Microsoft Azure:**
- 2022: $67.2B (+46% YoY)
- 2023: $82.0B (+22% YoY)
- 2024: $95.1B (+16% YoY)

**Google Cloud:**
- 2022: $26.3B (+36% YoY)
- 2023: $33.1B (+26% YoY)
- 2024: $40.2B (+21% YoY)

Microsoft Azure shows strongest sustained growth, while AWS
growth is decelerating but maintains largest absolute revenue.

Sources:
- amazon_10k_2024.pdf, page 28
- microsoft_10k_2024.pdf, page 45
- alphabet_10k_2024.pdf, page 52
```

## Document Processing Examples

Users upload their own documents. Processing time and chunk counts depend on document size.

### Large Document Handling

**Example Upload:** 500-page Tesla 10-K report (2024)

**Processing:**

- GPU parsing: ~5 minutes for full document (MinerU OCR)
- Chunking: 2,500+ semantic chunks created (max 2000 chars per chunk)
- Embedding: Voyage AI embeddings generated (2048 dimensions)
- Indexing: Stored in Qdrant with metadata (company, year, document_type, fiscal_quarter, etc.)

**Result:** Document indexed and queryable within 5-10 minutes

### Batch Processing

**Example Upload:** 10 documents (Alphabet annual reports 2015-2024)

**Processing:**

- Documents queued in Redis
- Parallel GPU processing (2 workers)
- Total processing time: ~25 minutes for 10 documents
- All documents indexed and ready for queries

## API Usage Examples

### Upload and Query Workflow

```bash
# Replace YOUR_DEPLOYMENT_URL with your actual Railway backend URL
# Example: https://finlens-backend-production.up.railway.app

# 1. Upload document (descriptions must be JSON array string)
curl -X POST https://YOUR_DEPLOYMENT_URL/v1/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@apple_10k_2024.pdf" \
  -F "descriptions=[\"Apple Annual Report 2024\"]"

# 2. Wait for processing (check status)
curl -X GET https://YOUR_DEPLOYMENT_URL/v1/documents/{document_id} \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Query the document
curl -X POST https://YOUR_DEPLOYMENT_URL/v1/chat/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is Apple'\''s revenue breakdown by product category?",
    "session_id": "optional-session-uuid"
  }'
```

## Performance Characteristics

| Document Size | Processing Time | Chunks Generated |
| ------------- | --------------- | ---------------- |
| 100 pages     | ~1 minute       | 500 chunks       |
| 300 pages     | ~3 minutes      | 1,500 chunks     |
| 500 pages     | ~5 minutes      | 2,500 chunks     |
| 1000+ pages   | ~10 minutes     | 5,000+ chunks    |

Query response times average 10-15 seconds for complex multi-document queries with full agent workflow execution.
