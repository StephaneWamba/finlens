"""
Authentication module for Supabase Auth integration.

This module provides FastAPI dependencies for authentication using Supabase's
built-in authentication system. All token verification is handled by Supabase.
"""

from backend.core.auth.dependencies import (
    get_current_user,
    get_optional_user,
    get_admin_user,
    security,
)

__all__ = [
    "get_current_user",
    "get_optional_user",
    "get_admin_user",
    "security",
]
