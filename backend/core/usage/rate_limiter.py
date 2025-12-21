"""
Rate limiting and usage limit checking.

This module enforces subscription-based query limits by checking if users
have remaining queries for the current month. It raises HTTP 429 errors
when limits are exceeded, providing clear error messages to guide users
toward subscription upgrades.
"""

from typing import Tuple, Optional
import logging
from fastapi import HTTPException, status

from backend.core.users.service import user_service

logger = logging.getLogger(__name__)


def check_usage_limit(user_id: str) -> Tuple[bool, Optional[int], Optional[int]]:
    """
    Check if user has remaining queries for the month.

    Args:
        user_id: User UUID string

    Returns:
        Tuple of (has_queries_remaining, queries_used, query_limit)
        Raises HTTPException if limit exceeded
    """
    has_remaining, queries_used, query_limit = user_service.check_query_limit(
        user_id)

    if not has_remaining:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Usage limit exceeded",
                "queries_used": queries_used,
                "query_limit": query_limit,
                "message": f"You have reached your monthly query limit of {query_limit}. Please upgrade your subscription to continue."
            }
        )

    return has_remaining, queries_used, query_limit
