"""
Stripe client setup and initialization.

This module provides a singleton Stripe client instance that is initialized
once and reused across the application. The client is configured with the
Stripe secret key from environment variables.

The module ensures:
• Single instance pattern for the Stripe client
• Proper error handling if the secret key is missing
• Support for testing via reset function
"""

import logging
import stripe

from backend.config.settings import settings

logger = logging.getLogger(__name__)

# Global Stripe client instance
_stripe_client = None


def get_stripe_client():
    """
    Get or create Stripe client instance.

    Returns:
        Stripe client instance (the stripe module itself)

    Raises:
        ValueError: If Stripe secret key is not configured
    """
    global _stripe_client

    if _stripe_client is not None:
        return _stripe_client

    if not settings.STRIPE_SECRET_KEY:
        raise ValueError(
            "Stripe secret key must be configured. "
            "Set STRIPE_SECRET_KEY in environment variables."
        )

    try:
        stripe.api_key = settings.STRIPE_SECRET_KEY
        _stripe_client = stripe
        logger.info("Stripe client initialized successfully")
        return _stripe_client
    except Exception as e:
        logger.error(f"Failed to initialize Stripe client: {e}")
        raise


def reset_stripe_client() -> None:
    """
    Reset Stripe client (useful for testing).

    Clears the global client instance, forcing re-initialization on next call.
    """
    global _stripe_client
    _stripe_client = None
