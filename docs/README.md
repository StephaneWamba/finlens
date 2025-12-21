# FinLens Documentation

Multi-agent RAG system for analyzing financial documents (SEC filings, annual reports, regulatory documents) using GPU-accelerated parsing and vector search.

## Quick Links

- **[Repository](https://github.com/StephaneWamba/finlens)** - Source code and issues
- **[API Reference](./api.md)** - REST API documentation
- **[Architecture](./architecture.md)** - System design overview
- **[Deployment](./deployment.md)** - Production setup guide
- **[Examples](./examples.md)** - Query examples and use cases

## Technical Documentation

- **[Workflow](./technical/workflow.md)** - LangGraph state machine and agent orchestration
- **[Chunking](./technical/chunking.md)** - Document chunking strategy and algorithms
- **[Retrieval](./technical/retrieval.md)** - Hybrid search implementation

## Overview

Processes financial documents through GPU-accelerated parsing (MinerU OCR) and multi-agent AI analysis. Users upload documents and query them using natural language. The system uses LangGraph orchestration with 3 specialized agents for retrieval, analysis, and generation.

## Key Capabilities

| Feature                    | Description                                              |
| -------------------------- | -------------------------------------------------------- |
| **Document Processing**    | GPU-accelerated parsing of PDFs, DOCX files              |
| **Intelligent Search**     | Hybrid semantic + keyword retrieval across documents     |
| **Conversational AI**      | Natural language queries with context awareness          |
| **Financial Analysis**     | SEC filing insights, company comparisons, trend analysis |
| **Multi-Document Support** | Cross-reference information across multiple filings      |

## Getting Started

1. Deploy the system using the [deployment guide](./deployment.md)
2. Upload financial documents (PDF, DOCX)
3. Query documents using natural language
4. Retrieve answers with source citations

## Support

- [GitHub Issues](https://github.com/StephaneWamba/finlens/issues)
