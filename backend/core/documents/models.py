"""
Pydantic models for document domain.
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum
from uuid import UUID


class DocumentType(str, Enum):
    """Supported document types."""
    FORM_10K = "10-K"
    FORM_10Q = "10-Q"
    FORM_8K = "8-K"
    FORM_10K_AMENDMENT = "10-K/A"
    FORM_10Q_AMENDMENT = "10-Q/A"
    ANNUAL_REPORT = "Annual Report"
    QUARTERLY_REPORT = "Quarterly Report"
    EARNINGS_RELEASE = "Earnings Release"
    PROXY_STATEMENT = "Proxy Statement"
    OTHER = "Other"


class DocumentCategory(str, Enum):
    """Document categories."""
    SEC_FILING = "sec_filing"
    EARNINGS_RELEASE = "earnings_release"
    PROXY_STATEMENT = "proxy_statement"
    ANNUAL_REPORT = "annual_report"
    QUARTERLY_REPORT = "quarterly_report"
    OTHER = "other"


class PeriodType(str, Enum):
    """Period types."""
    ANNUAL = "annual"
    QUARTERLY = "quarterly"
    MONTHLY = "monthly"


class CompanySector(str, Enum):
    """GICS Sectors."""
    TECHNOLOGY = "Technology"
    HEALTHCARE = "Healthcare"
    FINANCIAL_SERVICES = "Financial Services"
    CONSUMER_DISCRETIONARY = "Consumer Discretionary"
    CONSUMER_STAPLES = "Consumer Staples"
    ENERGY = "Energy"
    INDUSTRIALS = "Industrials"
    MATERIALS = "Materials"
    REAL_ESTATE = "Real Estate"
    UTILITIES = "Utilities"
    COMMUNICATION_SERVICES = "Communication Services"
    OTHER = "Other"


class ReportingStandard(str, Enum):
    """Financial reporting standards."""
    GAAP = "GAAP"
    IFRS = "IFRS"
    OTHER = "Other"


class Currency(str, Enum):
    """ISO 4217 Currency codes."""
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"
    CNY = "CNY"
    CAD = "CAD"
    AUD = "AUD"
    CHF = "CHF"
    OTHER = "Other"


class FilingType(str, Enum):
    """Filing types."""
    ORIGINAL = "original"
    AMENDMENT = "amendment"
    CORRECTION = "correction"


class StockExchange(str, Enum):
    """Major stock exchanges."""
    NYSE = "NYSE"
    NASDAQ = "NASDAQ"
    LSE = "LSE"
    TSE = "TSE"
    HKEX = "HKEX"
    OTHER = "Other"


class DocumentStatus(str, Enum):
    """Document processing status."""
    UPLOADED = "uploaded"
    VALIDATING = "validating"
    # Deprecated: Office conversion not supported (Vast.ai handles PDF only)
    CONVERTING = "converting"  # DEPRECATED
    # Deprecated: Parsing handled by Vast.ai server
    PARSING = "parsing"  # DEPRECATED
    PARSED = "parsed"  # DEPRECATED
    INDEXING = "indexing"  # DEPRECATED
    INDEXED = "indexed"  # Still used for checking completion status
    FAILED = "failed"


class DocumentExtension(str, Enum):
    """Supported document extensions."""
    PDF = ".pdf"
    PNG = ".png"
    JPG = ".jpg"
    JPEG = ".jpeg"


class DocumentMetadata(BaseModel):
    """Rich metadata schema for financial documents."""
    # Company information
    company_name: Optional[str] = Field(None, description="Company name")
    company_ticker: Optional[str] = Field(
        None, description="Stock ticker symbol")
    company_sector: Optional[CompanySector] = Field(
        None, description="Company sector (GICS sector)")
    company_industry: Optional[str] = Field(
        None, description="Company industry")
    company_country: Optional[str] = Field(None, description="Company country")
    company_exchange: Optional[StockExchange] = Field(
        None, description="Stock exchange")

    # Document type (ENUM - must choose from predefined types)
    document_type: Optional[DocumentType] = Field(
        None, description="Document type (10-K, 10-Q, Annual Report, etc.)")
    document_category: Optional[DocumentCategory] = Field(
        None, description="Document category (sec_filing, earnings_release, etc.)")
    filing_type: Optional[FilingType] = Field(
        None, description="Filing type (original, amendment, correction)")

    # Temporal information
    fiscal_year: Optional[int] = Field(
        None, ge=2015, le=2030, description="Fiscal year")
    fiscal_quarter: Optional[int] = Field(
        None, ge=1, le=4, description="Fiscal quarter (1-4)")
    fiscal_period_end: Optional[str] = Field(
        None, description="Fiscal period end date")
    period_type: Optional[PeriodType] = Field(
        None, description="Period type (annual, quarterly, monthly)")

    # Content flags
    has_financial_statements: Optional[bool] = Field(
        None, description="Contains financial statements")
    has_mda: Optional[bool] = Field(None, description="Contains MD&A section")
    has_risk_factors: Optional[bool] = Field(
        None, description="Contains risk factors")
    has_compensation: Optional[bool] = Field(
        None, description="Contains compensation info")
    has_governance: Optional[bool] = Field(
        None, description="Contains governance info")

    # Other (ENUM - must choose from predefined standards/currencies)
    reporting_standard: Optional[ReportingStandard] = Field(
        None, description="Reporting standard (GAAP, IFRS, Other)")
    currency: Optional[Currency] = Field(
        None, description="Currency code (USD, EUR, GBP, etc.)")

    class Config:
        extra = "allow"  # Allow additional fields for flexibility


class DocumentBase(BaseModel):
    """Base document model."""
    filename: str = Field(..., description="Stored filename")
    original_filename: str = Field(..., description="Original upload filename")
    file_extension: DocumentExtension = Field(...,
                                              description="File extension")
    file_size: int = Field(..., gt=0, description="File size in bytes")
    mime_type: str = Field(..., description="MIME type")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Document metadata")


class DocumentCreate(DocumentBase):
    """Model for creating a new document."""
    user_id: UUID = Field(..., description="User ID")


class DocumentUpdate(BaseModel):
    """Model for updating document status."""
    status: Optional[DocumentStatus] = None
    page_count: Optional[int] = None
    error_message: Optional[str] = None
    content_list_path: Optional[str] = None
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None
    indexed_at: Optional[datetime] = None


class Document(DocumentBase):
    """Full document model with database fields."""
    id: UUID
    user_id: UUID
    status: DocumentStatus
    page_count: Optional[int] = None
    error_message: Optional[str] = None
    content_list_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    indexed_at: Optional[datetime] = None
    processing_started_at: Optional[datetime] = None
    processing_completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
