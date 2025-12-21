"""User management routes for profile and account operations."""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field

from backend.core.auth.dependencies import get_current_user
from backend.core.users.service import user_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])


class UserProfileUpdate(BaseModel):
    """User profile update request"""
    full_name: Optional[str] = Field(None, description="User's full name")


class UserProfileResponse(BaseModel):
    """User profile response"""
    id: str
    email: str
    full_name: Optional[str]
    subscription_tier: str
    subscription_status: str
    monthly_query_limit: int
    queries_used_this_month: int
    created_at: str


@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Get current user's profile information."""
    try:
        user_id = current_user["id"]
        profile = user_service.get_user_profile(user_id)

        if not profile:
            # Profile doesn't exist, create it
            profile = user_service.create_user_profile(
                user_id=user_id,
                email=current_user.get("email", ""),
                full_name=current_user.get("full_name")
            )

        return UserProfileResponse(**profile)

    except Exception as e:
        logger.error(f"Error getting user profile: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve user profile: {str(e)}"
        )


@router.patch("/me", response_model=UserProfileResponse)
async def update_my_profile(
    update: UserProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update current user's profile."""
    try:
        user_id = current_user["id"]

        # Build update dict (only include provided fields)
        updates = {}
        if update.full_name is not None:
            updates["full_name"] = update.full_name

        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        updated_profile = user_service.update_user_profile(user_id, **updates)

        if not updated_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )

        return UserProfileResponse(**updated_profile)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user profile"
        )


@router.get("/me/usage")
async def get_my_usage(
    current_user: dict = Depends(get_current_user),
    days: int = 30
):
    """Get current user's detailed usage statistics."""
    try:
        user_id = current_user["id"]

        # Get detailed usage stats from tracker
        from backend.core.usage.tracker import usage_tracker
        stats = usage_tracker.get_user_usage_stats(user_id, days=days)

        # Get user profile for subscription info
        profile = user_service.get_user_profile(user_id)

        return {
            "queries_used_this_month": stats["queries_used_this_month"],
            "monthly_query_limit": stats["monthly_limit"],
            "queries_remaining": stats["queries_remaining"],
            "has_queries_remaining": stats["queries_remaining"] > 0,
            "subscription_tier": profile.get("subscription_tier", "free") if profile else "free",
            "subscription_status": profile.get("subscription_status", "active") if profile else "active",
            "period_stats": {
                "total_queries": stats["total_queries"],
                "successful_queries": stats["successful_queries"],
                "failed_queries": stats["failed_queries"],
                "success_rate": (stats["successful_queries"] / stats["total_queries"] * 100) if stats["total_queries"] > 0 else 0,
                "total_cost_usd": stats["total_cost_usd"],
                "average_cost_per_query": stats["average_cost_per_query"],
                "total_tokens": stats["total_tokens"],
                "period_days": stats["period_days"]
            }
        }

    except Exception as e:
        logger.error(f"Error getting usage stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve usage statistics"
        )


@router.get("/me/queries")
async def get_my_query_history(
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    days: Optional[int] = None
):
    """Get current user's query history."""
    try:
        from backend.core.usage.tracker import usage_tracker
        from datetime import datetime, timedelta

        user_id = current_user["id"]
        limit = min(limit, 100)  # Cap at 100

        # Build query
        query = usage_tracker.supabase.table("query_usage").select(
            "id, query_text, cost_usd, tokens_used, success, error_message, created_at"
        ).eq("user_id", user_id)

        # Filter by days if provided
        if days:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query = query.gte("created_at", cutoff_date.isoformat())

        # Order by most recent first, paginate
        result = query.order("created_at", desc=True).range(
            offset, offset + limit - 1).execute()

        queries = result.data or []

        return {
            "queries": queries,
            "total": len(queries),
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        logger.error(f"Error getting query history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve query history"
        )


@router.get("/me/usage/trends")
async def get_my_usage_trends(
    current_user: dict = Depends(get_current_user),
    days: int = 30
):
    """Get current user's usage trends (daily breakdown)."""
    try:
        from backend.core.usage.tracker import usage_tracker

        user_id = current_user["id"]
        days = min(days, 90)  # Cap at 90 days

        # Use optimized RPC function for SQL GROUP BY
        rpc_result = usage_tracker.supabase.rpc(
            'get_user_usage_trends',
            {
                'user_id_param': user_id,
                'days_param': days
            }
        ).execute()

        if rpc_result.data:
            trends = [
                {
                    "date": trend.get("date"),
                    "queries": int(trend.get("queries", 0)),
                    "successful_queries": int(trend.get("successful_queries", 0)),
                    "failed_queries": int(trend.get("failed_queries", 0)),
                    "total_cost_usd": float(trend.get("total_cost_usd", 0)),
                    "total_tokens": int(trend.get("total_tokens", 0))
                }
                for trend in rpc_result.data
            ]

            return {
                "trends": trends,
                "period_days": days,
                "total_days_with_activity": len(trends)
            }

        return {
            "trends": [],
            "period_days": days,
            "total_days_with_activity": 0
        }

    except Exception as e:
        logger.error(f"Error getting usage trends: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve usage trends"
        )
