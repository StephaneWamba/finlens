"""Supabase storage operations."""
import json
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

_supabase_client = None


def init_supabase(url: str, secret_key: str) -> bool:
    """Initialize Supabase client."""
    global _supabase_client
    try:
        from supabase import create_client, Client
        _supabase_client = create_client(url, secret_key)
        logger.info("Supabase client initialized")
        return True
    except ImportError:
        logger.warning("Supabase not installed - storage features disabled")
        return False
    except Exception as e:
        logger.warning(f"Failed to initialize Supabase: {e}")
        return False


def upload_content_list(
    content_list: List[Dict[str, Any]],
    storage_path: str,
    bucket: str
) -> bool:
    """Upload content_list.json to Supabase Storage."""
    if not _supabase_client:
        return False

    try:
        content_json = json.dumps(
            content_list, indent=2, ensure_ascii=False
        ).encode('utf-8')
        storage = _supabase_client.storage.from_(bucket)

        try:
            storage.upload(
                path=storage_path,
                file=content_json,
                file_options={"content-type": "application/json"}
            )
            logger.info(f"Uploaded content_list.json to {storage_path}")
            return True
        except Exception as e:
            error_str = str(e)
            if "409" in error_str or "already exists" in error_str.lower() or "Duplicate" in error_str:
                storage.update(
                    path=storage_path,
                    file=content_json,
                    file_options={"content-type": "application/json"}
                )
                logger.info(f"Updated content_list.json at {storage_path}")
                return True
            else:
                raise
    except Exception as e:
        logger.error(f"Failed to upload to Supabase: {e}")
        return False

