"""
Supabase client setup and initialization
"""

from typing import Optional
from supabase import create_client, Client
from backend.config.settings import settings
import logging

logger = logging.getLogger(__name__)

# Global Supabase client instance
_supabase_client: Optional[Client] = None


def get_supabase_client(use_service_role: bool = False) -> Client:
    """
    Get or create Supabase client instance

    Args:
        use_service_role: If True, use service role key (bypasses RLS).
                         If False, use regular key from settings.
                         Defaults to False, but will use SUPABASE_SERVICE_KEY if available.

    Returns:
        Supabase client instance

    Raises:
        ValueError: If Supabase URL or key is not configured
    """
    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    if not settings.SUPABASE_URL:
        raise ValueError(
            "Supabase URL must be configured. "
            "Set SUPABASE_URL in environment variables or use default (http://localhost:54331 for local)."
        )

    api_key = None
    if use_service_role:
        api_key = settings.SUPABASE_SECRET_KEY or settings.SUPABASE_SERVICE_KEY
        key_type = "secret (bypasses RLS)"
        if not api_key:
            raise ValueError(
                "Secret key requested but SUPABASE_SECRET_KEY is not configured. "
                "Set SUPABASE_SECRET_KEY in environment variables."
            )
    else:
        api_key = settings.SUPABASE_KEY
        key_type = "anon"

    if not api_key:
        raise ValueError(
            "Supabase API key must be configured. "
            "For local development, run 'supabase start' then 'supabase status' to get the keys. "
            "Set SUPABASE_KEY (or SUPABASE_SERVICE_KEY for MVP without auth) in environment variables."
        )

    try:
        _supabase_client = create_client(
            settings.SUPABASE_URL,
            api_key
        )
        logger.info(
            f"Supabase client initialized successfully (URL: {settings.SUPABASE_URL}, key: {key_type})")
        return _supabase_client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        if "localhost" in settings.SUPABASE_URL or "127.0.0.1" in settings.SUPABASE_URL:
            logger.error(
                "Local Supabase may not be running. "
                "Try running: supabase start"
            )
        raise


def reset_supabase_client() -> None:
    """Reset Supabase client (useful for testing)"""
    global _supabase_client
    _supabase_client = None
