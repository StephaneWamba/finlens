"""
Stripe webhook handlers for subscription events.

This module processes Stripe webhook events to keep subscription status
synchronized between Stripe and our database. It handles:
• Subscription creation, updates, and cancellations
• Payment success and failure events
• Signature verification for security

Webhook events are received at POST /v1/subscriptions/webhook and must
include a valid Stripe signature header for verification.
"""

import logging
from fastapi import Request, HTTPException, status
import stripe

from backend.config.settings import settings
from backend.core.payments.subscription_service import subscription_service

logger = logging.getLogger(__name__)


async def handle_stripe_webhook(request: Request) -> dict:
    """
    Handle Stripe webhook events.

    Args:
        request: FastAPI request with Stripe webhook payload

    Returns:
        Success response

    Raises:
        HTTPException: If webhook signature is invalid
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not settings.STRIPE_WEBHOOK_SECRET:
        logger.error("Stripe webhook secret not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook secret not configured"
        )

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.error(f"Invalid payload: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payload"
        )
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature"
        )

    # Handle the event
    event_type = event["type"]
    event_data = event["data"]["object"]

    logger.info(f"Received Stripe webhook: {event_type}")

    try:
        if event_type == "customer.subscription.created":
            handle_subscription_created(event_data)
        elif event_type == "customer.subscription.updated":
            handle_subscription_updated(event_data)
        elif event_type == "customer.subscription.deleted":
            handle_subscription_deleted(event_data)
        elif event_type == "invoice.payment_succeeded":
            handle_payment_succeeded(event_data)
        elif event_type == "invoice.payment_failed":
            handle_payment_failed(event_data)
        else:
            logger.debug(f"Unhandled event type: {event_type}")

        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error handling webhook event {event_type}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing webhook: {str(e)}"
        )


def handle_subscription_created(subscription: dict):
    """
    Handle subscription.created event.

    Args:
        subscription: Stripe subscription object from webhook
    """
    stripe_subscription_id = subscription["id"]
    status = subscription["status"]
    logger.info(
        f"Subscription created: {stripe_subscription_id}, status: {status}")
    subscription_service.update_subscription_from_webhook(
        stripe_subscription_id, status
    )


def handle_subscription_updated(subscription: dict):
    """
    Handle subscription.updated event.

    Args:
        subscription: Stripe subscription object from webhook
    """
    stripe_subscription_id = subscription["id"]
    status = subscription["status"]
    logger.info(
        f"Subscription updated: {stripe_subscription_id}, status: {status}")
    subscription_service.update_subscription_from_webhook(
        stripe_subscription_id, status
    )


def handle_subscription_deleted(subscription: dict):
    """
    Handle subscription.deleted event.

    Args:
        subscription: Stripe subscription object from webhook
    """
    stripe_subscription_id = subscription["id"]
    logger.info(f"Subscription deleted: {stripe_subscription_id}")
    subscription_service.update_subscription_from_webhook(
        stripe_subscription_id, "cancelled"
    )


def handle_payment_succeeded(invoice: dict):
    """
    Handle invoice.payment_succeeded event.

    Args:
        invoice: Stripe invoice object from webhook
    """
    subscription_id = invoice.get("subscription")
    if subscription_id:
        logger.info(f"Payment succeeded for subscription: {subscription_id}")
        subscription_service.update_subscription_from_webhook(
            subscription_id, "active"
        )


def handle_payment_failed(invoice: dict):
    """
    Handle invoice.payment_failed event.

    Args:
        invoice: Stripe invoice object from webhook
    """
    subscription_id = invoice.get("subscription")
    if subscription_id:
        logger.warning(f"Payment failed for subscription: {subscription_id}")
        subscription_service.update_subscription_from_webhook(
            subscription_id, "past_due"
        )
