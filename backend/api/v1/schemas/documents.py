"""
Pydantic schemas for document API endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from backend.core.documents.models import DocumentMetadata


class DocumentUploadResponse(BaseModel):
    """Response for document upload."""
    document_id: UUID = Field(..., description="Document ID")
    status: str = Field(..., description="Document status")
    message: str = Field(..., description="Status message")
    metadata: Optional[Dict[str, Any]] = Field(
        None, description="Extracted/applied metadata")


class DocumentResponse(BaseModel):
    """Document response model."""
    id: UUID = Field(..., description="Document ID")
    filename: str = Field(..., description="Stored filename")
    original_filename: str = Field(..., description="Original upload filename")
    file_extension: str = Field(..., description="File extension")
    file_size: int = Field(..., description="File size in bytes")
    status: str = Field(..., description="Processing status")
    page_count: Optional[int] = Field(None, description="Number of pages")
    mime_type: str = Field(..., description="MIME type")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Document metadata")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    indexed_at: Optional[datetime] = Field(
        None, description="Indexing timestamp")
    error_message: Optional[str] = Field(
        None, description="Error message if failed")
    original_pdf_url: Optional[str] = Field(
        None, description="Signed URL for original PDF")


class DocumentListResponse(BaseModel):
    """Response for listing documents."""
    documents: list[DocumentResponse] = Field(...,
                                              description="List of documents")
    total: int = Field(..., description="Total number of documents")
    limit: int = Field(..., description="Limit used")
    offset: int = Field(..., description="Offset used")


class DocumentDeleteResponse(BaseModel):
    """Response for document deletion."""
    message: str = Field(..., description="Status message")


class BatchUploadResponse(BaseModel):
    """Response for batch document upload."""
    total: int = Field(..., description="Total number of files in batch")
    successful: int = Field(..., description="Number of successful uploads")
    failed: int = Field(..., description="Number of failed uploads")
    results: list[DocumentUploadResponse] = Field(
        ..., description="Upload results for each file")
