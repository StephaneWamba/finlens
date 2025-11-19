"""LiveKit Agent implementation following best practices"""

import sys
import json
from pathlib import Path

# Add src directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from livekit.agents import Agent, AgentServer, AgentSession, JobContext, room_io, cli
from livekit import rtc
import asyncio
from livekit.plugins import openai
from supabase_client import get_agent_config
from config import settings, validate_openai_config
from utils.logger import setup_logger

logger = setup_logger(__name__)

# Create agent server instance
server = AgentServer()


@server.rtc_session()
async def entrypoint(ctx: JobContext):
    """
    Agent entrypoint - called when agent is dispatched to a LiveKit room
    
    Following LiveKit best practices:
    - Uses @server.rtc_session() decorator
    - AgentSession handles connection automatically
    - Simple, clean structure
    """
    # Set log context fields for better observability
    ctx.log_context_fields = {
        "room_name": ctx.room.name,
    }
    
    logger.info("Agent entrypoint called", {
        "room_name": ctx.room.name,
    })
    
    # Extract metadata from job
    agent_id = None
    conversation_id = None
    user_id = None
    
    metadata = ctx.job.metadata or {}
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except Exception:
            metadata = {}
    
    if isinstance(metadata, dict):
        agent_id = metadata.get("agentId") or metadata.get("agent_id")
        conversation_id = metadata.get("conversationId") or metadata.get("conversation_id")
        user_id = metadata.get("userId") or metadata.get("user_id")
    
    # Fallback to room metadata if job metadata not available
    if not agent_id and hasattr(ctx.room, 'metadata') and ctx.room.metadata:
        try:
            room_metadata = json.loads(ctx.room.metadata) if isinstance(ctx.room.metadata, str) else ctx.room.metadata
            if isinstance(room_metadata, dict):
                agent_id = room_metadata.get("agentId") or room_metadata.get("agent_id")
                conversation_id = room_metadata.get("conversationId") or room_metadata.get("conversation_id") or conversation_id
                user_id = room_metadata.get("userId") or room_metadata.get("user_id") or user_id
        except Exception:
            pass
    
    # Extract conversation_id from room name if available
    if not conversation_id and ctx.room.name.startswith("conversation:"):
        conversation_id = ctx.room.name.replace("conversation:", "")
    
    # Use default config if agent_id not found
    if not agent_id:
        agent_id = "unknown"
        logger.warning("Using default agent config (agentId not found)")
    
    logger.info("Agent initialized", {
        "agent_id": agent_id,
        "conversation_id": conversation_id,
        "user_id": user_id,
        "room_name": ctx.room.name,
    })
    
    # Validate OpenAI configuration
    if not validate_openai_config():
        raise ValueError("OpenAI API key is not configured. Please set OPENAI_API_KEY in environment variables.")
    
    # Load agent configuration
    if agent_id == "unknown":
        config = {
            "agent_id": "unknown",
            "name": "Test Agent",
            "model": "gpt-4o-mini",
            "system_prompt": (
                "You are a helpful AI assistant. "
                "IMPORTANT: You should continue the conversation indefinitely. "
                "Even if the user says 'I'm done', 'goodbye', 'end call', or similar phrases, "
                "you should acknowledge them politely but continue to be available. "
                "The call will only end when the user manually disconnects. "
                "Never attempt to end the conversation yourself - always remain available and helpful."
            ),
            "temperature": 0.7,
        }
    else:
        config = await get_agent_config(agent_id)
    
    logger.info("Agent config loaded", {
        "model": config.get("model", "unknown"),
        "agent_name": config.get("name", "unknown"),
    })
    
    # Create OpenAI Realtime model
    try:
        realtime_model = openai.realtime.RealtimeModel(
            voice="coral",
            model="gpt-4o-realtime-preview-2024-12-17",
            temperature=config.get("temperature", 0.7),
        )
        logger.info("OpenAI Realtime model created")
    except Exception as e:
        logger.error(f"Failed to create OpenAI Realtime model: {e}", exc_info=True)
        raise ValueError(f"Failed to initialize OpenAI Realtime API: {e}")
    
    # Create agent session
    session = AgentSession(
        llm=realtime_model,
    )
    
    # Add event listeners for session lifecycle
    def on_session_close(event):
        error = getattr(event, 'error', None)
        if error:
            logger.error(f"Session closed with error: {error}", exc_info=error if hasattr(error, '__traceback__') else None)
    
    def on_agent_state_changed(event):
        old_state = getattr(event, 'old_state', 'unknown')
        new_state = getattr(event, 'new_state', 'unknown')
        logger.info(f"Agent state: {old_state} -> {new_state}")
    
    session.on("close", on_session_close)
    session.on("agent_state_changed", on_agent_state_changed)
    
    # Configure room options - keep session alive during temporary disconnects
    room_options = room_io.RoomOptions(
        close_on_disconnect=False,
    )
    
    # Set up shutdown callback and room disconnect handler
    shutdown_future: asyncio.Future[None] = asyncio.Future()
    room_disconnect_future: asyncio.Future[None] = asyncio.Future()
    
    async def _on_shutdown(_reason: str) -> None:
        if not shutdown_future.done():
            shutdown_future.set_result(None)
    
    def _on_room_disconnected(_: rtc.Room) -> None:
        if not room_disconnect_future.done():
            room_disconnect_future.set_result(None)
    
    ctx.add_shutdown_callback(_on_shutdown)
    ctx.room.on("disconnected", _on_room_disconnected)
    
    # Start the session
    # Note: With OpenAI Realtime, session.start() returns immediately but session continues running
    # We keep the entrypoint alive by waiting for shutdown or room disconnect
    try:
        session_task = asyncio.create_task(
            session.start(
                room=ctx.room,
                agent=Agent(instructions=config["system_prompt"]),
                room_options=room_options,
            )
        )
        
        # Wait for session start, shutdown signal, or room disconnect
        done, pending = await asyncio.wait(
            [session_task, shutdown_future, room_disconnect_future],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # If session.start() returned immediately (normal for OpenAI Realtime),
        # continue waiting for shutdown or room disconnect
        if session_task in done:
            try:
                await session_task
            except Exception as e:
                logger.warning(f"Session task error: {e}", exc_info=True)
            
            await asyncio.wait(
                [shutdown_future, room_disconnect_future],
                return_when=asyncio.FIRST_COMPLETED
            )
        
        # Cancel pending tasks
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            
    except Exception as e:
        logger.error(f"Session error: {e}", exc_info=True)
        raise
    finally:
        ctx.room.off("disconnected", _on_room_disconnected)
        
        if hasattr(session, 'aclose'):
            try:
                await session.aclose()
            except Exception as e:
                logger.warning(f"Error closing session: {e}", exc_info=True)


if __name__ == "__main__":
    cli.run_app(server)
