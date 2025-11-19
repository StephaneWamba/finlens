"""Supabase client for fetching agent configurations"""

import sys
from pathlib import Path

# Add src directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from supabase import create_client, Client
from typing import Optional, Dict, Any
from config import settings
from utils.logger import setup_logger

logger = setup_logger(__name__)

_supabase_client: Optional[Client] = None

def get_supabase_client() -> Client:
    """Get or create Supabase client"""
    global _supabase_client
    
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key
        )
    
    return _supabase_client

async def get_agent_config(agent_id: str) -> Dict[str, Any]:
    """Fetch agent configuration from Supabase"""
    try:
        supabase = get_supabase_client()
        
        response = supabase.table("agent_configs").select(
            "id, name, model, system_prompt, temperature"
        ).eq("id", agent_id).single().execute()
        
        if not response.data:
            raise ValueError(f"Agent {agent_id} not found")
        
        config = response.data
        
        logger.info(f"Fetched agent config", {
            "agent_id": agent_id,
            "name": config.get("name"),
            "model": config.get("model"),
        })
        
        return {
            "agent_id": config.get("id"),
            "name": config.get("name") or "AI Assistant",
            "model": config.get("model") or "gpt-4o-mini",
            "system_prompt": config.get("system_prompt") or "You are a helpful AI assistant.",
            "temperature": config.get("temperature") or 0.7,
        }
    except Exception as e:
        logger.error(f"Failed to fetch agent config: {e}", {
            "agent_id": agent_id,
        })
        raise

