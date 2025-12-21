"""Background worker for processing tasks."""
import asyncio
import logging
import shutil
import tempfile
from pathlib import Path
from datetime import datetime, timezone

try:
    from . import config
    from . import task_queue
    from . import mineru
    from . import storage
    from . import indexer
except ImportError:
    # Allow running as script
    import config
    import task_queue
    import mineru
    import storage
    import indexer
import httpx

logger = logging.getLogger(__name__)

_worker_semaphore = None


def init_worker():
    """Initialize worker semaphore."""
    global _worker_semaphore
    _worker_semaphore = asyncio.Semaphore(config.MAX_CONCURRENT_WORKERS)


async def process_task(task_data: dict):
    """Process a single task (PDF parsing + indexing)."""
    task_id = task_data["task_id"]
    file_data = task_data["file_data"]
    user_id = task_data["user_id"]
    document_id = task_data["document_id"]
    metadata = task_data.get("metadata")  # Can be dict or None
    upload_to_storage = task_data.get("upload_to_storage", True)
    index_doc = task_data.get("index", True)

    temp_dir = None

    try:
        # Mark as processing
        task_queue.update_task_status(
            task_id, task_queue.TaskStatus.PROCESSING)
        task_queue.mark_processing(task_id)

        logger.info(
            f"Processing task {task_id}: {task_data.get('filename', 'unknown')}")

        # Save file to temp directory
        temp_dir = Path(tempfile.mkdtemp(prefix=f"mineru_{document_id}_"))
        pdf_path = temp_dir / task_data.get("filename", f"{document_id}.pdf")

        with open(pdf_path, 'wb') as f:
            f.write(file_data)

        logger.info(f"Saved PDF to {pdf_path} ({len(file_data)} bytes)")

        # Create output directory
        output_dir = temp_dir / "output"
        output_dir.mkdir(parents=True, exist_ok=True)

        # Process with MinerU (GPU-accelerated)
        logger.info("Starting MinerU processing...")
        content_list = await asyncio.to_thread(
            mineru.parse_pdf,
            pdf_path,
            output_dir,
            config.MINERU_BACKEND,
            config.MINERU_TIMEOUT
        )
        logger.info(
            f"MinerU processing complete. Generated {len(content_list)} elements")

        # Calculate page count
        page_count = len(set(elem.get('page_idx', 0)
                         for elem in content_list)) if content_list else 0

        # Upload to Supabase Storage (if requested)
        content_list_path = None
        if upload_to_storage:
            storage_path = f"{user_id}/{document_id}/content_list.json"
            if await asyncio.to_thread(
                storage.upload_content_list,
                content_list,
                storage_path,
                config.DOCUMENT_STORAGE_BUCKET
            ):
                content_list_path = storage_path

        # Index document (if requested)
        chunks_indexed = 0
        if index_doc and config.VOYAGE_API_KEY and config.QDRANT_URL:
            # Use metadata as-is (already extracted by Railway AI)
            # Just ensure filename is included
            indexing_metadata = dict(metadata) if metadata else {}
            indexing_metadata["filename"] = task_data.get("filename")
            chunks_indexed = await asyncio.to_thread(
                indexer.index_document,
                user_id,
                document_id,
                content_list,
                indexing_metadata,
                config.VOYAGE_API_KEY,
                config.VOYAGE_MODEL,
                config.QDRANT_URL,
                config.QDRANT_API_KEY,
                config.COLLECTION_NAME
            )
            logger.info(
                f"Indexed {chunks_indexed} chunks for document {document_id}")

        # Calculate processing time
        created_at = datetime.fromisoformat(task_data["created_at"])
        # Ensure timezone-aware for comparison
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        processing_time = (datetime.now(timezone.utc) -
                           created_at).total_seconds()

        result = {
            "success": True,
            "document_id": document_id,
            "message": "Processing completed successfully",
            "content_list_path": content_list_path,
            "processing_time_seconds": processing_time,
            "page_count": page_count,
            "elements_count": len(content_list),
            "chunks_indexed": chunks_indexed,
            "filename": task_data.get("filename")
        }

        # Mark as completed - ensure this happens before unmark_processing
        try:
            task_queue.update_task_status(
                task_id, task_queue.TaskStatus.COMPLETED, result)
            logger.info(f"Task {task_id} status updated to COMPLETED")
        except Exception as status_error:
            logger.error(
                f"Failed to update task status to COMPLETED: {status_error}")

        # Send webhook
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(config.WEBHOOK_URL, json={
                    "task_id": task_id,
                    "status": "completed",
                    "result": result
                })
        except Exception as e:
            logger.warning(f"Webhook notification failed: {e}")

        logger.info(f"Task {task_id} completed successfully")

    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}", exc_info=True)
        try:
            task_queue.update_task_status(task_id, task_queue.TaskStatus.FAILED, {
                "success": False,
                "error": str(e)
            })
        except Exception as status_error:
            logger.error(
                f"Failed to update task status to FAILED: {status_error}")

        # Send webhook for failure
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(config.WEBHOOK_URL, json={
                    "task_id": task_id,
                    "status": "failed",
                    "error": {
                        "document_id": document_id,
                        "message": str(e)
                    }
                })
        except Exception as e:
            logger.warning(f"Webhook notification failed: {e}")

    finally:
        # Always unmark processing, even if status update fails
        try:
            task_queue.unmark_processing(task_id)
        except Exception as unmark_error:
            logger.error(f"Failed to unmark processing: {unmark_error}")

        # Cleanup - COMMENTED OUT FOR DEBUGGING
        # if temp_dir and temp_dir.exists():
        #     shutil.rmtree(temp_dir, ignore_errors=True)
        if temp_dir and temp_dir.exists():
            logger.info(
                f"DEBUG: Keeping temp directory for inspection: {temp_dir}")


async def worker_loop():
    """Background worker loop that processes tasks from the queue."""
    logger.info(
        f"Worker loop started (max concurrent: {config.MAX_CONCURRENT_WORKERS})")

    while True:
        try:
            # Dequeue task
            task_data = task_queue.dequeue_task()

            if task_data:
                task_id = task_data.get("task_id")

                # Check if task is already completed or failed (prevent reprocessing)
                existing_status = task_queue.get_task_status(task_id)
                if existing_status:
                    status = existing_status.get("status")
                    if status in ["completed", "failed"]:
                        logger.warning(
                            f"Skipping task {task_id}: already {status}")
                        task_queue.unmark_processing(task_id)
                        continue

                # Acquire semaphore (limits concurrency)
                async with _worker_semaphore:
                    await process_task(task_data)
            else:
                # No tasks available, sleep briefly
                await asyncio.sleep(0.5)

        except Exception as e:
            logger.error(f"Worker loop error: {e}", exc_info=True)
            await asyncio.sleep(1)
