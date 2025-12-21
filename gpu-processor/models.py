"""Pydantic models for API requests and responses."""
from typing import List
from pydantic import BaseModel


class ProcessResponse(BaseModel):
    """Response model for document processing."""
    task_id: str
    status_url: str


class BatchProcessResponse(BaseModel):
    """Response model for batch processing."""
    total: int
    tasks: List[ProcessResponse]
