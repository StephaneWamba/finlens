"""Redis queue management."""
import json
import logging
import uuid
import base64
import queue as stdlib_queue
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from enum import Enum

logger = logging.getLogger(__name__)

# In-memory fallback
_processing_queue = None
_task_status = {}


class TaskStatus(str, Enum):
    """Task status enumeration."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


def init_redis(redis_url: str) -> bool:
    """Initialize Redis client."""
    global _redis_client
    try:
        import redis
        _redis_client = redis.from_url(redis_url, decode_responses=True)
        _redis_client.ping()
        logger.info(f"Redis connected: {redis_url}")
        return True
    except ImportError:
        logger.warning("Redis not installed - using in-memory queue")
        _redis_client = None
        return False
    except Exception as e:
        logger.warning(f"Redis connection failed: {e} - using in-memory queue")
        _redis_client = None
        return False


_redis_client = None
QUEUE_KEY = "mineru:queue"
STATUS_KEY_PREFIX = "mineru:status:"
PROCESSING_KEY = "mineru:processing"


def enqueue_task(task_data: Dict[str, Any]) -> str:
    """Enqueue a task to Redis or in-memory queue."""
    task_id = str(uuid.uuid4())
    task_data["task_id"] = task_id
    task_data["status"] = TaskStatus.PENDING.value
    task_data["created_at"] = datetime.now(timezone.utc).isoformat()

    if _redis_client:
        # Encode file_data (bytes) as base64 for JSON serialization
        task_data_for_redis = task_data.copy()
        if "file_data" in task_data_for_redis and isinstance(task_data_for_redis["file_data"], bytes):
            task_data_for_redis["file_data"] = base64.b64encode(task_data_for_redis["file_data"]).decode('utf-8')
            task_data_for_redis["_file_data_encoded"] = True
        
        _redis_client.lpush(QUEUE_KEY, json.dumps(task_data_for_redis))
        _redis_client.setex(
            f"{STATUS_KEY_PREFIX}{task_id}",
            86400,  # 24 hours TTL
            json.dumps({"status": TaskStatus.PENDING.value, "task": task_data_for_redis})
        )
    else:
        global _processing_queue, _task_status
        if _processing_queue is None:
            _processing_queue = stdlib_queue.Queue()
        _processing_queue.put(task_data)
        _task_status[task_id] = {
            "status": TaskStatus.PENDING.value, "task": task_data}

    logger.info(
        f"Enqueued task {task_id}: {task_data.get('filename', 'unknown')}")
    return task_id


def dequeue_task() -> Optional[Dict[str, Any]]:
    """Dequeue a task from Redis or in-memory queue."""
    if _redis_client:
        try:
            result = _redis_client.brpop(QUEUE_KEY, timeout=1)
            if result:
                task_data = json.loads(result[1])
                task_id = task_data.get("task_id")
                
                # Check if task is already completed/failed (safety check)
                if task_id:
                    existing_status = get_task_status(task_id)
                    if existing_status:
                        status = existing_status.get("status")
                        if status in ["completed", "failed"]:
                            logger.warning(
                                f"Dequeued task {task_id} that is already {status}, skipping")
                            return None
                
                # Decode file_data from base64 if it was encoded
                if "_file_data_encoded" in task_data and task_data.get("_file_data_encoded"):
                    if "file_data" in task_data and isinstance(task_data["file_data"], str):
                        task_data["file_data"] = base64.b64decode(task_data["file_data"])
                    task_data.pop("_file_data_encoded", None)
                return task_data
            return None
        except Exception as e:
            logger.error(f"Error dequeuing task: {e}")
            return None
    else:
        try:
            return _processing_queue.get_nowait()
        except:
            return None


def update_task_status(
    task_id: str,
    status: TaskStatus,
    result: Optional[Dict[str, Any]] = None
):
    """Update task status in Redis or in-memory."""
    status_data = {
        "status": status.value,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    if result:
        status_data["result"] = result

    if _redis_client:
        try:
            existing = _redis_client.get(f"{STATUS_KEY_PREFIX}{task_id}")
            if existing:
                task_data = json.loads(existing)
                task_data.update(status_data)
            else:
                # If status doesn't exist, create it
                task_data = status_data
                task_data["task_id"] = task_id
            
            _redis_client.setex(
                f"{STATUS_KEY_PREFIX}{task_id}",
                86400,  # 24 hours TTL
                json.dumps(task_data)
            )
            logger.debug(f"Updated task {task_id} status to {status.value}")
        except Exception as e:
            logger.error(f"Failed to update task status in Redis: {e}")
            raise
    else:
        if task_id in _task_status:
            _task_status[task_id].update(status_data)
        else:
            _task_status[task_id] = status_data


def get_task_status(task_id: str) -> Optional[Dict[str, Any]]:
    """Get task status from Redis or in-memory."""
    if _redis_client:
        data = _redis_client.get(f"{STATUS_KEY_PREFIX}{task_id}")
        if data:
            return json.loads(data)
        return None
    else:
        return _task_status.get(task_id)


def get_queue_length() -> int:
    """Get current queue length."""
    if _redis_client:
        return _redis_client.llen(QUEUE_KEY)
    else:
        return _processing_queue.qsize() if _processing_queue else 0


def get_processing_count() -> int:
    """Get number of currently processing tasks."""
    if _redis_client:
        return _redis_client.scard(PROCESSING_KEY)
    else:
        return sum(1 for status in _task_status.values()
                   if status.get("status") == TaskStatus.PROCESSING.value)


def mark_processing(task_id: str):
    """Mark task as processing."""
    if _redis_client:
        _redis_client.sadd(PROCESSING_KEY, task_id)


def unmark_processing(task_id: str):
    """Unmark task as processing."""
    if _redis_client:
        _redis_client.srem(PROCESSING_KEY, task_id)


def is_redis_configured() -> bool:
    """Check if Redis is configured and connected."""
    return _redis_client is not None
