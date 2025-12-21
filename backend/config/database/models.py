"""
Pydantic models for database entities
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from uuid import UUID


class ConversationMessage(BaseModel):
    """Single message in a conversation"""
    role: str = Field(..., description="Message role: user, assistant, system")
    content: str = Field(..., description="Message content")


class ConversationMetadata(BaseModel):
    """Metadata for a conversation"""
    companies: Optional[List[str]] = Field(
        default=None, description="Companies mentioned")
    years: Optional[List[int]] = Field(
        default=None, description="Years mentioned")
    topics: Optional[List[str]] = Field(
        default=None, description="Topics discussed")
    charts: Optional[List[Dict[str, Any]]] = Field(
        default=None, description="Chart.js configurations")
    sources: Optional[List[Dict[str, Any]]] = Field(
        default=None, description="Source citations")
