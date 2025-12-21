"""AI-powered metadata extraction from user descriptions."""
from typing import Optional
import logging

from backend.core.documents.models import DocumentMetadata
from backend.core.ai.llm import llm_manager

logger = logging.getLogger(__name__)


class MetadataExtractor:
    """Extract metadata from user descriptions using AI."""

    SYSTEM_PROMPT = """You are a financial document metadata extraction expert.
Your task is to extract structured metadata from user descriptions of financial documents.

IMPORTANT: You must use ONLY the predefined enum values for constrained fields. Do not invent new values.

Available Document Types (choose ONE):
- 10-K (Annual SEC filing)
- 10-Q (Quarterly SEC filing)
- 8-K (Current report)
- 10-K/A (Amended annual filing)
- 10-Q/A (Amended quarterly filing)
- Annual Report
- Quarterly Report
- Earnings Release
- Proxy Statement
- Other

Available Document Categories (choose ONE):
- sec_filing (SEC filings like 10-K, 10-Q, 8-K)
- earnings_release (Earnings announcements)
- proxy_statement (Proxy statements)
- annual_report (Annual reports)
- quarterly_report (Quarterly reports)
- other

Available Period Types (choose ONE):
- annual
- quarterly
- monthly

Available Sectors (GICS - choose ONE):
- Technology
- Healthcare
- Financial Services
- Consumer Discretionary
- Consumer Staples
- Energy
- Industrials
- Materials
- Real Estate
- Utilities
- Communication Services
- Other

Available Reporting Standards (choose ONE):
- GAAP (Generally Accepted Accounting Principles)
- IFRS (International Financial Reporting Standards)
- Other

Available Currencies (ISO 4217 - choose ONE):
- USD (US Dollar)
- EUR (Euro)
- GBP (British Pound)
- JPY (Japanese Yen)
- CNY (Chinese Yuan)
- CAD (Canadian Dollar)
- AUD (Australian Dollar)
- CHF (Swiss Franc)
- Other

Available Filing Types (choose ONE):
- original
- amendment
- correction

Available Stock Exchanges (choose ONE):
- NYSE (New York Stock Exchange)
- NASDAQ (Nasdaq Stock Market)
- LSE (London Stock Exchange)
- TSE (Tokyo Stock Exchange)
- HKEX (Hong Kong Stock Exchange)
- Other

Extract the following information when available:
- Company name and ticker symbol (free text)
- Document type (MUST use enum values above)
- Fiscal year and quarter (if applicable)
- Sector (MUST use enum values above)
- Industry (free text)
- Other relevant metadata fields

Be precise and only extract information that is clearly stated or can be confidently inferred.
Leave fields as None if the information is not available or uncertain.
For enum fields, you MUST choose from the predefined list above."""

    USER_PROMPT_TEMPLATE = """Extract metadata from this document description:

{description}

Filename: {filename}

Provide structured metadata for this financial document."""

    def extract_from_description(
        self,
        description: str,
        filename: Optional[str] = None
    ) -> DocumentMetadata:
        """Extract metadata from user description using AI."""
        try:
            # Format user prompt
            user_prompt = self.USER_PROMPT_TEMPLATE.format(
                description=description,
                filename=filename or "unknown"
            )

            # Generate structured output using DocumentMetadata model
            metadata = llm_manager.generate_structured(
                prompt=user_prompt,
                response_model=DocumentMetadata,
                task="metadata_extraction",
                system_prompt=self.SYSTEM_PROMPT,
                temperature=0.1  # Low temperature for accuracy
            )

            logger.info(
                f"Extracted metadata: company={metadata.company_name}, "
                f"type={metadata.document_type}, year={metadata.fiscal_year}"
            )

            return metadata

        except Exception as e:
            logger.error(f"Error extracting metadata: {e}", exc_info=True)
            # Return empty metadata on error
            return DocumentMetadata()
