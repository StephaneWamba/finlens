"""Subscription management routes for Stripe integration."""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends, Request
from pydantic import BaseModel, Field

from backend.core.auth.dependencies import get_current_user
from backend.core.payments.subscription_service import subscription_service
from backend.core.payments.webhooks import handle_stripe_webhook

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


class CreateSubscriptionRequest(BaseModel):
    """Create subscription request"""
    price_id: str = Field(..., description="Stripe price ID for the subscription tier")


class SubscriptionResponse(BaseModel):
    """Subscription response"""
    tier: str
    tier_name: str
    status: str
    monthly_query_limit: int
    queries_used_this_month: int
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None


@router.get("/me", response_model=SubscriptionResponse)
async def get_my_subscription(current_user: dict = Depends(get_current_user)):
    """Get current user's subscription information."""
    try:
        user_id = current_user["id"]
        subscription = subscription_service.get_user_subscription(user_id)

        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subscription not found"
            )

        return SubscriptionResponse(**subscription)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve subscription"
        )


@router.post("/create", response_model=dict)
async def create_subscription(
    request: CreateSubscriptionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new subscription for the current user."""
    try:
        user_id = current_user["id"]
        result = subscription_service.create_subscription(
            user_id=user_id,
            price_id=request.price_id
        )

        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create subscription"
            )

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create subscription"
        )


@router.post("/cancel")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Cancel current user's subscription."""
    try:
        user_id = current_user["id"]
        success = subscription_service.cancel_subscription(user_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to cancel subscription"
            )

        return {"message": "Subscription cancelled successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel subscription"
        )


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    return await handle_stripe_webhook(request)

