"""Chat API routes for the financial analysis system."""

import logging
import uuid

from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks, Request
import asyncio

from backend.api.v1.schemas.chat import ChatRequest, ChatResponse
from backend.core.ai.agent import run_query
from backend.core.ai.llm import llm_manager
from backend.core.auth.dependencies import get_current_user
from backend.core.usage.rate_limiter import check_usage_limit
from backend.core.usage.tracker import usage_tracker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/query", response_model=ChatResponse)
async def chat_query(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Process a chat query through the 3-agent system."""
    try:
        # Check if client disconnected
        def check_disconnected():
            if http_request.client is None:
                return True
            return False
        # Use authenticated user's ID instead of request.user_id
        user_id = current_user["id"]

        # Check usage limit before processing
        check_usage_limit(user_id)

        # Generate session_id if not provided
        session_id = request.session_id or str(uuid.uuid4())

        # Convert messages to format expected by agent
        messages = []
        if request.messages:
            for msg in request.messages:
                messages.append({
                    "role": msg.role,
                    "content": msg.content
                })

        logger.info(
            f"Processing query for user={user_id}, session={session_id}")
        logger.debug(f"Query: {request.query}")

        # Get cost before query (to track total cost)
        cost_before = llm_manager.get_cost_summary().get("total_cost", 0.0)

        # Run agent workflow in executor to allow cancellation
        loop = asyncio.get_event_loop()
        try:
            final_state = await loop.run_in_executor(
                None,
                run_query,
                request.query,
                user_id,
                session_id,
                messages
            )
        except asyncio.CancelledError:
            logger.info(
                f"Query cancelled for user={user_id}, session={session_id}")
            raise HTTPException(
                status_code=499,  # Client Closed Request
                detail="Request was cancelled"
            )

        # Get cost after query
        cost_after = llm_manager.get_cost_summary().get("total_cost", 0.0)
        query_cost = cost_after - cost_before

        # Extract response
        response = final_state.get("response")
        if not response:
            # Record failed query (async)
            background_tasks.add_task(
                usage_tracker.record_query,
                user_id=user_id,
                query_text=request.query,
                cost_usd=query_cost,
                success=False,
                error_message="Agent workflow completed but no response generated"
            )
            raise HTTPException(
                status_code=500,
                detail="Agent workflow completed but no response generated"
            )

        # Check for errors
        if final_state.get("error"):
            # Record failed query (async)
            background_tasks.add_task(
                usage_tracker.record_query,
                user_id=user_id,
                query_text=request.query,
                cost_usd=query_cost,
                success=False,
                error_message=final_state.get("error")
            )
            logger.error(f"Agent workflow error: {final_state['error']}")
            raise HTTPException(
                status_code=500,
                detail=f"Agent workflow error: {final_state['error']}"
            )

        # Record successful query (async - fire-and-forget)
        background_tasks.add_task(
            usage_tracker.record_query,
            user_id=user_id,
            query_text=request.query,
            response_text=response.text[:5000] if response.text else None,
            cost_usd=query_cost,
            success=True
        )

        # Return response
        return ChatResponse(
            text=response.text,
            charts=response.charts,
            sources=response.sources,
            metadata={
                **response.metadata,
                "session_id": session_id,
                "retrieval_attempts": final_state.get("retrieval_attempts", 0),
                "self_heal_attempts": final_state.get("self_heal_attempts", 0),
                "query_cost": query_cost
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing chat query: {e}", exc_info=True)
        # Try to record the failed query for tracking (async)
        try:
            background_tasks.add_task(
                usage_tracker.record_query,
                user_id=user_id,
                query_text=request.query,
                cost_usd=0.0,
                success=False,
                error_message=str(e)
            )
        except Exception as record_error:
            logger.error(
                f"Error scheduling query usage recording: {record_error}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/sessions")
async def list_sessions(
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """Get list of all chat sessions for the current user."""
    try:
        pass

        user_id = current_user["id"]
        from backend.core.ai.memory.manager import get_memory_manager
        memory_manager = get_memory_manager()

        limit = min(limit, 100)  # Cap at 100
        offset = max(offset, 0)  # Ensure non-negative

        # Get sessions with offset
        all_sessions = memory_manager.get_all_sessions(
            user_id=user_id,
            limit=limit + offset  # Fetch more to account for offset
        )

        # Apply offset
        sessions = all_sessions[offset:offset + limit]
        has_more = len(all_sessions) > offset + limit

        return {
            "sessions": sessions,
            "total": len(sessions),
            "limit": limit,
            "offset": offset,
            "has_more": has_more
        }

    except Exception as e:
        logger.error(f"Error retrieving sessions: {e}", exc_info=True)
        # Return empty list instead of 500 error for better UX
        # This handles cases where the conversations table doesn't exist yet
        return {
            "sessions": [],
            "total": 0
        }


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    limit: int = 10,
    offset: int = 0
):
    """Get session information with paginated messages."""
    try:
        pass

        user_id = current_user["id"]
        from backend.core.ai.memory.manager import get_memory_manager
        memory_manager = get_memory_manager()

        # Get all conversations for this session
        conversations = memory_manager.get_conversations_by_session(
            user_id=user_id,
            session_id=session_id
        )

        # Aggregate all messages from all conversations in the session
        all_messages = []
        total_messages = 0

        logger.info(
            f"Retrieved {len(conversations)} conversations for session {session_id}")
        for i, conv in enumerate(conversations):
            messages = conv.get("messages", [])
            logger.info(
                f"Conversation {i}: messages type={type(messages)}, length={len(messages) if isinstance(messages, list) else 'N/A'}")
            if messages:
                if isinstance(messages, list):
                    all_messages.extend(messages)
                    total_messages += len(messages)
                else:
                    logger.warning(
                        f"Conversation {i}: messages is not a list, type={type(messages)}")

        # Sort messages by timestamp if available
        all_messages.sort(
            key=lambda x: x.get("timestamp", ""),
            reverse=False
        )

        # Apply pagination: return last N messages (most recent)
        # Offset 0 = most recent, higher offset = older messages
        limit = min(limit, 100)  # Cap at 100
        offset = max(offset, 0)  # Ensure non-negative

        total_messages_count = len(all_messages)

        # Calculate pagination: get last (limit + offset) messages, then take first 'limit'
        # This gives us the most recent messages first
        start_idx = max(0, total_messages_count - limit - offset)
        end_idx = total_messages_count - offset if offset > 0 else total_messages_count
        paginated_messages = all_messages[start_idx:end_idx]

        has_more = offset + limit < total_messages_count

        # Extract metadata and charts from conversations
        metadata = {}

        # Build a map of conversation_id -> charts/sources for proper matching
        conv_charts_map = {}  # conversation_id -> list of charts
        conv_sources_map = {}  # conversation_id -> list of sources
        all_charts = []  # Fallback: all charts in order
        all_sources = []  # Fallback: all sources

        # Collect charts and sources from ALL conversations in the session
        for conv in conversations:
            conv_id = conv.get("id") or conv.get("conversation_id")
            conv_metadata = conv.get("metadata", {})
            if conv_metadata:
                # Collect charts from this conversation
                conv_charts = conv_metadata.get("charts", [])
                if conv_charts:
                    if conv_id:
                        conv_charts_map[conv_id] = conv_charts
                    all_charts.extend(conv_charts)

                # Collect sources from this conversation
                conv_sources = conv_metadata.get("sources", [])
                if conv_sources:
                    if conv_id:
                        conv_sources_map[conv_id] = conv_sources
                    all_sources.extend(conv_sources)

        # Get metadata from the most recent conversation for other metadata fields
        if conversations:
            latest_conv = conversations[-1]
            metadata = latest_conv.get("metadata", {})

        # Build a map of message -> conversation_id by checking which conversation contains each message
        message_to_conv = {}
        for conv in conversations:
            conv_id = conv.get("id") or conv.get("conversation_id")
            conv_messages = conv.get("messages", [])
            for conv_msg in conv_messages:
                # Match messages by content and role (simple matching)
                msg_key = (conv_msg.get("role"),
                           conv_msg.get("content", "")[:100])
                message_to_conv[msg_key] = conv_id

        # Attach charts and sources to assistant messages
        # Match charts with [CHART:X] placeholders in message content
        import re
        chart_index = 0  # Fallback sequential index
        for msg in paginated_messages:
            if msg.get("role") == "assistant":
                content = msg.get("content", "")

                # Try to find which conversation this message belongs to
                msg_key = (msg.get("role"), content[:100])
                conv_id = message_to_conv.get(msg_key)

                # Count how many chart placeholders are in this message
                chart_placeholders = re.findall(r'\[CHART:(\d+)\]', content)
                num_charts_in_message = len(chart_placeholders)

                charts_for_message = []
                if num_charts_in_message > 0:
                    # Try to get charts from the specific conversation first
                    if conv_id and conv_id in conv_charts_map:
                        conv_charts = conv_charts_map[conv_id]
                        if len(conv_charts) >= num_charts_in_message:
                            charts_for_message = conv_charts[:num_charts_in_message]
                            logger.info(
                                f"Attached {len(charts_for_message)} charts from conversation {conv_id} to message"
                            )

                    # Fallback: use sequential matching from all_charts
                    if not charts_for_message and chart_index < len(all_charts):
                        charts_for_message = all_charts[chart_index:chart_index +
                                                        num_charts_in_message]
                        chart_index += num_charts_in_message
                        logger.info(
                            f"Attached {len(charts_for_message)} charts (sequential) to message. "
                            f"Chart index: {chart_index}, Total charts: {len(all_charts)}"
                        )

                msg["charts"] = charts_for_message

                # Add sources to assistant messages (prefer conversation-specific sources)
                if conv_id and conv_id in conv_sources_map:
                    msg["sources"] = conv_sources_map[conv_id]
                elif all_sources:
                    msg["sources"] = all_sources
                else:
                    msg["sources"] = []

        return {
            "session_id": session_id,
            "status": "active" if conversations else "empty",
            "message_count": len(paginated_messages),
            "total_messages": total_messages_count,
            "conversation_count": len(conversations),
            "messages": paginated_messages,
            "metadata": metadata,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "has_more": has_more,
                "total": total_messages_count
            }
        }

    except Exception as e:
        logger.error(f"Error retrieving session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve session: {str(e)}"
        )
