"""
Rate limiting utilities for user-based rate limiting.
"""
from fastapi import Request
from slowapi.util import get_remote_address


def get_user_id_for_rate_limit(request: Request) -> str:
    """
    Get user ID from request for rate limiting.
    
    Falls back to IP address if user is not authenticated.
    """
    # Try to get user_id from request state (set by get_current_user dependency)
    if hasattr(request.state, "user_id"):
        return f"user:{request.state.user_id}"
    
    # Fallback to IP address for unauthenticated requests
    return get_remote_address(request)


def get_rate_limit_key(request: Request) -> str:
    """
    Get rate limit key for the request.
    
    Uses user_id if available, otherwise IP address.
    """
    return get_user_id_for_rate_limit(request)

