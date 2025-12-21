"""User service for managing user profiles and operations."""

from typing import Optional, Dict, Any
import logging

from backend.config.database.supabase_client import get_supabase_client
from backend.core.utils.cache import user_profile_cache

logger = logging.getLogger(__name__)


class UserService:
    """Service for user management operations"""

    def __init__(self):
        # Use service role to bypass RLS for backend operations
        self.supabase = get_supabase_client(use_service_role=True)

    def get_user_profile(self, user_id: str, use_cache: bool = True) -> Optional[Dict[str, Any]]:
        """Get user profile by ID with optional caching."""
        cache_key = f"user_profile:{user_id}"

        # Try cache first if enabled
        if use_cache:
            cached_profile = user_profile_cache.get(cache_key)
            if cached_profile is not None:
                return cached_profile

        try:
            # Fetch from database
            result = self.supabase.table("users").select(
                "*").eq("id", user_id).execute()
            if result.data:
                profile = result.data[0]
                # Cache the result
                if use_cache:
                    user_profile_cache.set(cache_key, profile)
                return profile
            return None
        except Exception as e:
            logger.error(f"Error getting user profile: {e}")
            return None

    def create_user_profile(
        self,
        user_id: str,
        email: str,
        full_name: Optional[str] = None,
        subscription_tier: str = "free"
    ) -> Dict[str, Any]:
        """Create a new user profile."""
        try:
            profile_data = {
                "id": user_id,
                "email": email,
                "full_name": full_name,
                "subscription_tier": subscription_tier,
                "subscription_status": "active",
                "monthly_query_limit": 10,  # Free tier default
                "queries_used_this_month": 0,
            }

            result = self.supabase.table(
                "users").insert(profile_data).execute()
            if result.data:
                profile = result.data[0]
                # Cache the newly created profile
                cache_key = f"user_profile:{user_id}"
                user_profile_cache.set(cache_key, profile)
                logger.info(f"Created user profile for {user_id}")
                return profile
            raise ValueError("Failed to create user profile")
        except Exception as e:
            logger.error(f"Error creating user profile: {e}")
            raise

    def update_user_profile(
        self,
        user_id: str,
        **updates
    ) -> Optional[Dict[str, Any]]:
        """Update user profile fields."""
        try:
            result = self.supabase.table("users").update(
                updates).eq("id", user_id).execute()
            if result.data:
                profile = result.data[0]
                # Update cache with new profile data
                cache_key = f"user_profile:{user_id}"
                user_profile_cache.set(cache_key, profile)
                logger.info(f"Updated user profile for {user_id}")
                return profile
            return None
        except Exception as e:
            logger.error(f"Error updating user profile: {e}")
            raise

    def increment_query_count(self, user_id: str) -> bool:
        """Increment the user's query count for the current month using atomic SQL update."""
        try:
            # Use atomic SQL increment via RPC function - single query instead of read + write
            # This prevents race conditions and reduces database round-trips by 50%
            result = self.supabase.rpc(
                'increment_user_query_count',
                {'user_id_param': user_id}
            ).execute()

            if result.data and len(result.data) > 0:
                # Invalidate cache since query count changed
                cache_key = f"user_profile:{user_id}"
                user_profile_cache.delete(cache_key)
                return True
            return False
        except Exception as e:
            logger.error(f"Error incrementing query count: {e}")
            return False

    def check_query_limit(self, user_id: str) -> tuple[bool, Optional[int], Optional[int]]:
        """Check if user has remaining queries for the month."""
        try:
            user = self.get_user_profile(user_id)
            if not user:
                return False, None, None

            queries_used = user.get("queries_used_this_month", 0)
            query_limit = user.get("monthly_query_limit", 10)

            has_remaining = queries_used < query_limit
            return has_remaining, queries_used, query_limit
        except Exception as e:
            logger.error(f"Error checking query limit: {e}")
            return False, None, None


# Global user service instance
user_service = UserService()
