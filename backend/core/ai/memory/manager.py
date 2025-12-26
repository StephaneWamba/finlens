"""
Memory Manager - Handles conversation storage and retrieval across sessions.

Uses hybrid storage: Supabase for structured data, Qdrant for semantic search.
Provides cross-session memory retrieval and conversation summarization.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from uuid import UUID
import logging
import threading

from backend.config.database.supabase_client import get_supabase_client
from backend.config.database.models import (
    ConversationMessage,
    ConversationMetadata
)
from backend.core.ai.vector_db.qdrant_client import get_qdrant_client
from backend.config.constants import CONVERSATION_MEMORY_COLLECTION

logger = logging.getLogger(__name__)

# Singleton instance for MemoryManager
_memory_manager_instance = None
_memory_manager_lock = threading.Lock()


class MemoryManager:
    """Manages conversation memory using Supabase + Qdrant"""

    def __init__(self):
        self.supabase = get_supabase_client()
        from backend.core.ai.embedding.manager import get_embedding_manager
        self.embedding_manager = get_embedding_manager()
        # Note: qdrant_client is now initialized with collection creation in get_qdrant_client()
        self.qdrant_client = get_qdrant_client()
        self._ensure_collection_exists()

    def _ensure_collection_exists(self) -> None:
        """Ensure conversation_memory collection exists in Qdrant"""
        try:
            collections = self.qdrant_client.client.get_collections()
            collection_names = [c.name for c in collections.collections]

            if CONVERSATION_MEMORY_COLLECTION not in collection_names:
                logger.info(
                    f"Creating {CONVERSATION_MEMORY_COLLECTION} collection")
                # Get embedding dimensions from current embedder (2048 for Voyage AI)
                embedding_dimensions = self.embedding_manager.get_embedding_dimensions()
                self.qdrant_client.client.create_collection(
                    collection_name=CONVERSATION_MEMORY_COLLECTION,
                    vectors_config={
                        "size": embedding_dimensions,
                        "distance": "Cosine"
                    }
                )
                logger.info(
                    f"Created {CONVERSATION_MEMORY_COLLECTION} collection with {embedding_dimensions} dimensions")
            else:
                logger.debug(f"{CONVERSATION_MEMORY_COLLECTION} collection already exists")
        except Exception as e:
            logger.error(f"Error ensuring collection exists: {e}")
            raise

    def store_conversation(
        self,
        user_id: str,
        session_id: str,
        messages: List[ConversationMessage],
        summary: Optional[str] = None,
        metadata: Optional[ConversationMetadata] = None
    ) -> UUID:
        """
        Store a conversation in Supabase and Qdrant

        Args:
            user_id: User ID
            session_id: Session ID
            messages: Conversation messages
            summary: Compressed summary (optional)
            metadata: Conversation metadata (optional)

        Returns:
            Conversation ID (UUID)
        """
        try:
            # Store in Supabase
            conversation_data = {
                "user_id": user_id,
                "session_id": session_id,
                "messages": [msg.model_dump() for msg in messages],
                "summary": summary,
                "metadata": metadata.model_dump() if hasattr(metadata, 'model_dump') else (metadata if isinstance(metadata, dict) else None),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

            result = self.supabase.table("conversations").insert(
                conversation_data).execute()
            conversation_id = UUID(result.data[0]["id"])

            logger.info(f"Stored conversation {conversation_id} in Supabase")

            # Store in Qdrant for semantic search
            if summary:
                # Embed the summary
                embedding = self.embedding_manager.embed_text(summary)

                # Store in Qdrant
                self.qdrant_client.client.upsert(
                    collection_name=CONVERSATION_MEMORY_COLLECTION,
                    points=[{
                        "id": str(conversation_id),
                        "vector": embedding,
                        "payload": {
                            "user_id": user_id,
                            "session_id": session_id,
                            "conversation_id": str(conversation_id),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "summary": summary,
                            "metadata": metadata.model_dump() if metadata else {}
                        }
                    }]
                )
                logger.info(f"Stored conversation {conversation_id} in Qdrant")

            return conversation_id

        except Exception as e:
            logger.error(f"Error storing conversation: {e}")
            raise

    def get_relevant_memory(
        self,
        user_id: str,
        query: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get relevant past conversations for a user based on query

        Args:
            user_id: User ID
            query: Search query
            limit: Maximum number of results

        Returns:
            List of relevant conversations with metadata
        """
        try:
            # Embed the query
            # Use query embedding for search queries (Voyage optimization)
            query_embedding = self.embedding_manager.embed_query(query)

            # Search Qdrant filtered by user_id
            results = self.qdrant_client.client.search(
                collection_name=CONVERSATION_MEMORY_COLLECTION,
                query_vector=query_embedding,
                query_filter={
                    "must": [
                        {"key": "user_id", "match": {"value": user_id}}
                    ]
                },
                limit=limit
            )

            # Extract conversation IDs
            conversation_ids = [UUID(point.id) for point in results]

            if not conversation_ids:
                logger.info(f"No relevant memory found for user {user_id}")
                return []

            # Fetch all conversations in a single query using IN clause
            # This fixes N+1 query problem - reduces from N+1 queries to 1 query
            conversation_id_strings = [str(conv_id)
                                       for conv_id in conversation_ids]

            # Supabase PostgREST supports 'in' filter for batch fetching
            result = self.supabase.table("conversations").select(
                "*"
            ).in_("id", conversation_id_strings).execute()

            conversations = result.data or []

            logger.info(
                f"Retrieved {len(conversations)} relevant conversations for user {user_id}")
            return conversations

        except Exception as e:
            logger.error(f"Error retrieving memory: {e}")
            return []

    def update_conversation(
        self,
        conversation_id: UUID,
        summary: Optional[str] = None,
        messages: Optional[List[ConversationMessage]] = None,
        metadata: Optional[ConversationMetadata] = None
    ) -> None:
        """
        Update a conversation in Supabase and Qdrant

        Args:
            conversation_id: Conversation ID
            summary: Updated summary
            messages: Updated messages
            metadata: Updated metadata
        """
        try:
            update_data = {
                "updated_at": datetime.now(timezone.utc).isoformat()
            }

            if summary:
                update_data["summary"] = summary
            if messages:
                update_data["messages"] = [msg.model_dump()
                                           for msg in messages]
            if metadata:
                update_data["metadata"] = metadata.model_dump()

            # Update in Supabase
            self.supabase.table("conversations").update(
                update_data).eq("id", str(conversation_id)).execute()

            # Update in Qdrant if summary changed
            if summary:
                embedding = self.embedding_manager.embed_text(summary)

                # Get existing point to preserve other fields
                result = self.qdrant_client.client.retrieve(
                    collection_name=CONVERSATION_MEMORY_COLLECTION,
                    ids=[str(conversation_id)]
                )

                if result:
                    existing_payload = result[0].payload
                    existing_payload["summary"] = summary
                    if metadata:
                        existing_payload["metadata"] = metadata.model_dump()

                    self.qdrant_client.client.upsert(
                        collection_name=CONVERSATION_MEMORY_COLLECTION,
                        points=[{
                            "id": str(conversation_id),
                            "vector": embedding,
                            "payload": existing_payload
                        }]
                    )

            logger.info(f"Updated conversation {conversation_id}")

        except Exception as e:
            logger.error(f"Error updating conversation: {e}")
            raise

    def get_conversations_by_session(
        self,
        user_id: str,
        session_id: str
    ) -> List[Dict[str, Any]]:
        """
        Get all conversations for a specific session.

        Args:
            user_id: User ID
            session_id: Session ID

        Returns:
            List of conversations for the session, ordered by timestamp
        """
        try:
            # Query Supabase for all conversations with this session_id and user_id
            result = self.supabase.table("conversations").select(
                "*"
            ).eq("user_id", user_id).eq("session_id", session_id).order(
                "timestamp", desc=False
            ).execute()

            conversations = result.data or []
            logger.info(
                f"Retrieved {len(conversations)} conversations for session {session_id}")
            return conversations

        except Exception as e:
            logger.error(f"Error retrieving conversations by session: {e}")
            return []

    def get_all_sessions(
        self,
        user_id: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get all unique sessions for a user with summary information.

        Args:
            user_id: User ID
            limit: Maximum number of sessions to return

        Returns:
            List of sessions with session_id, last_message, last_updated, message_count
        """
        try:
            # Optimized: Use SQL to get distinct sessions with latest conversation
            # This reduces data transfer from limit*10 rows to just limit rows
            # Using DISTINCT ON would be ideal, but Supabase PostgREST doesn't support it directly
            # So we fetch the most recent conversations and group efficiently

            # Fetch recent conversations ordered by timestamp
            # We fetch limit*3 instead of limit*10 to reduce data transfer
            result = self.supabase.table("conversations").select(
                "session_id, messages, timestamp, summary"
            ).eq("user_id", user_id).order(
                "timestamp", desc=True
            ).limit(limit * 3).execute()  # Reduced from limit*10 to limit*3

            conversations = result.data or []

            # Group by session_id and get the most recent conversation for each
            # Use dict to track first occurrence (most recent due to ordering)
            sessions_dict: Dict[str, Dict[str, Any]] = {}
            session_message_counts: Dict[str, int] = {}

            for conv in conversations:
                session_id = conv.get("session_id")
                if not session_id:
                    continue

                messages = conv.get("messages", [])
                message_count = len(messages) if messages else 0

                if session_id not in sessions_dict:
                    # First conversation for this session (most recent due to ordering)
                    last_user_message = None
                    if messages:
                        # Find last user message
                        for msg in reversed(messages):
                            if isinstance(msg, dict) and msg.get("role") == "user":
                                last_user_message = msg.get("content", "")
                                break

                    sessions_dict[session_id] = {
                        "session_id": session_id,
                        "last_message": last_user_message or conv.get("summary", "New conversation"),
                        "last_updated": conv.get("timestamp"),
                        "message_count": message_count,
                    }
                    session_message_counts[session_id] = message_count
                else:
                    # Accumulate message count across all conversations in session
                    session_message_counts[session_id] += message_count
                    sessions_dict[session_id]["message_count"] = session_message_counts[session_id]

            # Convert to list and sort by last_updated
            sessions = list(sessions_dict.values())
            sessions.sort(
                key=lambda x: x.get("last_updated", ""),
                reverse=True
            )

            # Limit results
            sessions = sessions[:limit]

            logger.info(
                f"Retrieved {len(sessions)} sessions for user {user_id}")
            return sessions

        except Exception as e:
            logger.error(f"Error retrieving sessions: {e}")
            return []


def get_memory_manager() -> MemoryManager:
    """
    Get singleton MemoryManager instance.

    Creates the instance on first call and reuses it for all subsequent calls.
    This prevents redundant initialization and reduces memory usage.

    Returns:
        Singleton MemoryManager instance
    """
    global _memory_manager_instance
    if _memory_manager_instance is None:
        with _memory_manager_lock:
            if _memory_manager_instance is None:
                _memory_manager_instance = MemoryManager()
                logger.debug("MemoryManager singleton instance created")
    return _memory_manager_instance
