"""Subscription service for managing user subscriptions and Stripe integration."""

from typing import Optional, Dict, Any
import logging

from backend.config.database.supabase_client import get_supabase_client
from backend.core.payments.stripe_client import get_stripe_client

logger = logging.getLogger(__name__)


# Subscription tier definitions
SUBSCRIPTION_TIERS = {
    "free": {
        "name": "Free",
        "monthly_query_limit": 10
    },
    "pro": {
        "name": "Pro",
        "monthly_query_limit": 500
    },
    "enterprise": {
        "name": "Enterprise",
        "monthly_query_limit": -1  # -1 means unlimited
    }
}


class SubscriptionService:
    """Service for subscription management operations."""

    def __init__(self):
        self.supabase = get_supabase_client(use_service_role=True)
        self.stripe = get_stripe_client()

    def get_subscription_tier_info(self, tier: str) -> Optional[Dict[str, Any]]:
        """Get subscription tier information."""
        return SUBSCRIPTION_TIERS.get(tier.lower())

    def create_stripe_customer(
        self,
        user_id: str,
        email: str,
        name: Optional[str] = None
    ) -> Optional[str]:
        """Create a Stripe customer for a user."""
        try:
            customer = self.stripe.Customer.create(
                email=email,
                name=name,
                metadata={
                    "user_id": user_id
                }
            )

            # Update user profile with Stripe customer ID
            self.supabase.table("users").update({
                "stripe_customer_id": customer.id
            }).eq("id", user_id).execute()

            logger.info(
                f"Created Stripe customer {customer.id} for user {user_id}")
            return customer.id
        except Exception as e:
            logger.error(f"Error creating Stripe customer: {e}")
            return None

    def create_subscription(
        self,
        user_id: str,
        price_id: str
    ) -> Optional[Dict[str, Any]]:
        """Create a Stripe subscription for a user."""
        try:
            # Get user profile
            user_result = self.supabase.table("users").select(
                "*").eq("id", user_id).execute()
            if not user_result.data:
                logger.error(f"User {user_id} not found")
                return None

            user = user_result.data[0]
            stripe_customer_id = user.get("stripe_customer_id")

            # Create Stripe customer if doesn't exist
            if not stripe_customer_id:
                stripe_customer_id = self.create_stripe_customer(
                    user_id=user_id,
                    email=user.get("email", ""),
                    name=user.get("full_name")
                )
                if not stripe_customer_id:
                    return None

            # Create subscription in Stripe
            subscription = self.stripe.Subscription.create(
                customer=stripe_customer_id,
                items=[{"price": price_id}],
                metadata={
                    "user_id": user_id
                }
            )

            # Determine tier from price_id
            tier = self._get_tier_from_price_id(price_id)

            # Update user profile
            self.supabase.table("users").update({
                "stripe_subscription_id": subscription.id,
                "subscription_tier": tier,
                "subscription_status": subscription.status,
                "monthly_query_limit": SUBSCRIPTION_TIERS.get(tier, {}).get("monthly_query_limit", 10)
            }).eq("id", user_id).execute()

            logger.info(
                f"Created subscription {subscription.id} for user {user_id}")
            return {
                "subscription_id": subscription.id,
                "status": subscription.status,
                "tier": tier,
                "client_secret": subscription.latest_invoice.payment_intent.client_secret if subscription.latest_invoice else None
            }
        except Exception as e:
            logger.error(f"Error creating subscription: {e}")
            return None

    def cancel_subscription(self, user_id: str) -> bool:
        """Cancel a user's subscription."""
        try:
            user_result = self.supabase.table("users").select(
                "*").eq("id", user_id).execute()
            if not user_result.data:
                return False

            user = user_result.data[0]
            stripe_subscription_id = user.get("stripe_subscription_id")

            if not stripe_subscription_id:
                logger.warning(f"User {user_id} has no active subscription")
                return False

            # Cancel subscription in Stripe
            self.stripe.Subscription.modify(
                stripe_subscription_id,
                cancel_at_period_end=True
            )

            # Update user profile
            self.supabase.table("users").update({
                "subscription_status": "cancelled"
            }).eq("id", user_id).execute()

            logger.info(
                f"Cancelled subscription {stripe_subscription_id} for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error cancelling subscription: {e}")
            return False

    def update_subscription_from_webhook(
        self,
        stripe_subscription_id: str,
        status: str
    ) -> bool:
        """Update subscription status from Stripe webhook."""
        try:
            # Map Stripe status to our status
            status_map = {
                "active": "active",
                "canceled": "cancelled",
                "past_due": "past_due",
                "trialing": "trialing",
                "unpaid": "past_due"
            }
            our_status = status_map.get(status, "active")

            # Update user profile
            result = self.supabase.table("users").update({
                "subscription_status": our_status
            }).eq("stripe_subscription_id", stripe_subscription_id).execute()

            if result.data:
                logger.info(
                    f"Updated subscription {stripe_subscription_id} to status {our_status}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error updating subscription from webhook: {e}")
            return False

    def _get_tier_from_price_id(self, price_id: str) -> str:
        """Get subscription tier from Stripe price ID."""
        from backend.config.settings import settings

        # Check against configured price IDs
        if hasattr(settings, 'STRIPE_PRO_PRICE_ID') and settings.STRIPE_PRO_PRICE_ID == price_id:
            return "pro"
        elif hasattr(settings, 'STRIPE_ENTERPRISE_PRICE_ID') and settings.STRIPE_ENTERPRISE_PRICE_ID == price_id:
            return "enterprise"

        # Fallback: try to get from Stripe API
        try:
            price = self.stripe.Price.retrieve(price_id)
            tier_metadata = price.metadata.get('tier', 'pro')
            return tier_metadata if tier_metadata in ['pro', 'enterprise'] else 'pro'
        except Exception as e:
            logger.warning(
                f"Could not determine tier from price_id {price_id}: {e}")
            return "pro"

    def get_user_subscription(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user's subscription information."""
        try:
            user_result = self.supabase.table("users").select(
                "*").eq("id", user_id).execute()
            if not user_result.data:
                return None

            user = user_result.data[0]
            tier = user.get("subscription_tier", "free")
            tier_info = self.get_subscription_tier_info(tier)

            return {
                "tier": tier,
                "tier_name": tier_info.get("name") if tier_info else tier,
                "status": user.get("subscription_status", "active"),
                "monthly_query_limit": user.get("monthly_query_limit", 10),
                "queries_used_this_month": user.get("queries_used_this_month", 0),
                "stripe_subscription_id": user.get("stripe_subscription_id"),
                "stripe_customer_id": user.get("stripe_customer_id")
            }
        except Exception as e:
            logger.error(f"Error getting user subscription: {e}")
            return None


# Global subscription service instance
subscription_service = SubscriptionService()
