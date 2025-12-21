"""
FastAPI dependencies for authentication and authorization.

This module provides FastAPI dependencies that use Supabase's built-in
authentication to verify JWT tokens and provide user context to protected endpoints.
"""

from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

from backend.config.database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

# HTTP Bearer token security scheme
security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    """
    FastAPI dependency to get the current authenticated user.

    Uses Supabase's built-in token verification to authenticate users.
    Automatically creates user profile if it doesn't exist.
    Also sets user_id in request.state for rate limiting.

    Args:
        request: FastAPI request object
        credentials: HTTP Bearer credentials from Authorization header

    Returns:
        Dictionary with user information (id, email, user_metadata, etc.)

    Raises:
        HTTPException: 401 if token is missing or invalid
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Use Supabase's built-in token verification
        # This properly verifies the token signature using Supabase's internal JWT secret
        supabase = get_supabase_client()

        # Supabase client's get_user() method verifies the token signature
        auth_response = supabase.auth.get_user(credentials.credentials)

        if not auth_response or not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        auth_user = auth_response.user
        user_id = auth_user.id

        # Set user_id in request.state for rate limiting
        request.state.user_id = user_id

        # Use cached user service to get profile (reduces database queries)
        from backend.core.users.service import user_service

        # Build user dict from Supabase auth user
        user = {
            "id": user_id,
            "user_id": user_id,
            "email": auth_user.email,
            "role": "authenticated",
            "user_metadata": auth_user.user_metadata or {},
            "app_metadata": auth_user.app_metadata or {},
        }

        # Get user profile from cache or database
        user_profile = user_service.get_user_profile(user_id, use_cache=True)
        if user_profile:
            user.update(user_profile)
        else:
            # User doesn't exist in users table yet - create profile
            logger.info(
                f"User {user_id} not found in users table, creating profile")
            try:
                created_profile = user_service.create_user_profile(
                    user_id=user_id,
                    email=auth_user.email or "",
                    full_name=(auth_user.user_metadata or {}).get("full_name")
                )
                if created_profile:
                    user.update(created_profile)
            except Exception as e:
                logger.warning(f"Failed to create user profile: {e}")
                # Continue anyway - user is authenticated, just missing profile

        return user

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error authenticating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[dict]:
    """
    FastAPI dependency to get the current user if authenticated, None otherwise.

    Similar to get_current_user but doesn't raise an error if token is missing.
    Useful for endpoints that work both with and without authentication.

    Args:
        credentials: HTTP Bearer credentials from Authorization header

    Returns:
        Dictionary with user information if authenticated, None otherwise
    """
    if not credentials:
        return None

    try:
        # Use Supabase's built-in token verification
        supabase = get_supabase_client()
        auth_response = supabase.auth.get_user(credentials.credentials)

        if not auth_response or not auth_response.user:
            return None

        auth_user = auth_response.user
        user_id = auth_user.id

        # Use cached user service to get profile
        from backend.core.users.service import user_service

        user = {
            "id": user_id,
            "user_id": user_id,
            "email": auth_user.email,
            "role": "authenticated",
            "user_metadata": auth_user.user_metadata or {},
            "app_metadata": auth_user.app_metadata or {},
        }

        user_profile = user_service.get_user_profile(user_id, use_cache=True)
        if user_profile:
            user.update(user_profile)
            return user

        return user

    except Exception as e:
        logger.debug(f"Optional authentication failed: {e}")
        return None


async def get_admin_user(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    FastAPI dependency to ensure the current user is an admin.

    Args:
        current_user: Current authenticated user from get_current_user

    Returns:
        User dictionary if admin

    Raises:
        HTTPException: 403 if user is not an admin
    """
    user_role = current_user.get("role") or current_user.get(
        "app_metadata", {}).get("role")

    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return current_user
