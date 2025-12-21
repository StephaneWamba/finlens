"""
Simple in-memory cache utility for frequently accessed data.

Provides TTL-based caching to reduce database queries for user profiles
and other frequently accessed data.
"""

from typing import Optional, Dict, Any, Callable
from datetime import datetime, timedelta
import threading
import logging

logger = logging.getLogger(__name__)


class CacheEntry:
    """Cache entry with expiration time"""

    def __init__(self, value: Any, ttl_seconds: int):
        self.value = value
        self.expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)

    def is_expired(self) -> bool:
        """Check if cache entry has expired"""
        return datetime.utcnow() >= self.expires_at


class SimpleCache:
    """
    Thread-safe in-memory cache with TTL support.

    Provides simple caching for frequently accessed data like user profiles.
    Automatically expires entries after TTL.
    """

    def __init__(self, default_ttl_seconds: int = 300):
        """
        Initialize cache.

        Args:
            default_ttl_seconds: Default time-to-live in seconds (default: 5 minutes)
        """
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = threading.Lock()
        self.default_ttl = default_ttl_seconds

    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found or expired
        """
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return None

            if entry.is_expired():
                del self._cache[key]
                return None

            return entry.value

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        """
        Set value in cache.

        Args:
            key: Cache key
            value: Value to cache
            ttl_seconds: Time-to-live in seconds (uses default if None)
        """
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        with self._lock:
            self._cache[key] = CacheEntry(value, ttl)

    def delete(self, key: str) -> None:
        """
        Delete value from cache.

        Args:
            key: Cache key
        """
        with self._lock:
            self._cache.pop(key, None)

    def clear(self) -> None:
        """Clear all cache entries"""
        with self._lock:
            self._cache.clear()

    def get_or_set(
        self,
        key: str,
        fetch_fn: Callable[[], Any],
        ttl_seconds: Optional[int] = None
    ) -> Any:
        """
        Get value from cache or fetch and cache it if not present.

        Args:
            key: Cache key
            fetch_fn: Function to fetch value if not in cache
            ttl_seconds: Time-to-live in seconds (uses default if None)

        Returns:
            Cached or freshly fetched value
        """
        value = self.get(key)
        if value is not None:
            return value

        # Fetch value
        value = fetch_fn()
        if value is not None:
            self.set(key, value, ttl_seconds)

        return value

    def size(self) -> int:
        """Get number of cache entries"""
        with self._lock:
            # Clean expired entries
            expired_keys = [
                key for key, entry in self._cache.items()
                if entry.is_expired()
            ]
            for key in expired_keys:
                del self._cache[key]
            return len(self._cache)


# Global cache instances
user_profile_cache = SimpleCache(default_ttl_seconds=300)  # 5 minutes TTL


