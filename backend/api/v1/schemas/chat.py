"""
Chat API schemas
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """Single chat message"""
    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    """Chat request schema"""
    query: str = Field(..., description="User query", min_length=1)
    session_id: Optional[str] = Field(
        None, description="Session identifier (auto-generated if not provided)")
    messages: Optional[List[ChatMessage]] = Field(
        default=[], description="Previous conversation messages")


class ChatResponse(BaseModel):
    """Chat response schema"""
    text: str = Field(..., description="Response text (Markdown with LaTeX, NO sources)")
    charts: List[Dict[str, Any]] = Field(
        default=[], description="Chart.js configurations")
    sources: List[Dict[str, Any]] = Field(
        default=[], description="Source citations (company, year, page)")
    metadata: Dict[str, Any] = Field(
        default={}, description="Response metadata")


class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(..., description="Service status")
    version: str = Field(..., description="API version")
    services: Dict[str, str] = Field(...,
                                     description="External service statuses")
