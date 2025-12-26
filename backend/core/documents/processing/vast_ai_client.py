"""
Vast.ai GPU server client for document processing.
Sends documents directly to Vast.ai server for GPU-accelerated processing.
"""
import logging
import httpx
from typing import List, Optional, Dict, Any
from backend.config.settings import settings

logger = logging.getLogger(__name__)


class VastAIClient:
    """Client for sending documents to Vast.ai GPU server."""

    def __init__(self):
        """Initialize Vast.ai client."""
        if not settings.VAST_AI_SERVER_URL:
            raise ValueError(
                "VAST_AI_SERVER_URL not configured. Set it in environment variables."
            )
        self.base_url = settings.VAST_AI_SERVER_URL.rstrip('/')
        logger.info(f"VastAIClient initialized with URL: {self.base_url}")

    async def process_documents(
        self,
        files: List[bytes],
        filenames: List[str],
        user_id: str,
        document_ids: List[str],
        metadatas: Optional[List[Optional[Dict[str, Any]]]] = None,
        upload_to_storage: bool = True,
        index: bool = True
    ) -> Dict[str, Any]:
        """
        Send documents to Vast.ai server for processing.

        Args:
            files: List of PDF file contents (bytes)
            filenames: List of filenames
            user_id: User UUID string
            document_ids: List of document UUIDs (one per file)
            metadatas: Optional list of metadata dicts (one per file, can be None)
            upload_to_storage: Whether to upload content_list.json to Supabase
            index: Whether to index chunks into Qdrant

        Returns:
            Response dict with task_id(s) and status_url(s)
        """
        if len(files) != len(filenames) or len(files) != len(document_ids):
            raise ValueError(
                "files, filenames, and document_ids must have the same length"
            )

        # Prepare form data
        import json
        files_data = [
            ("files", (filename, file_content, "application/pdf"))
            for filename, file_content in zip(filenames, files)
        ]

        form_data = {
            "user_id": user_id,
            "document_ids": json.dumps(document_ids),
            "upload_to_storage": str(upload_to_storage).lower(),
            "index": str(index).lower()
        }

        # Add metadatas if provided
        if metadatas:
            # Pad metadatas to match file count
            padded_metadatas = metadatas + \
                [None] * (len(files) - len(metadatas))
            form_data["metadatas"] = json.dumps([
                m if m is not None else {} for m in padded_metadatas[:len(files)]
            ])

        # Prepare headers with API key if configured
        headers = {}
        if settings.VAST_AI_API_KEY:
            headers["X-API-Key"] = settings.VAST_AI_API_KEY
            logger.info("API key configured, sending X-API-Key header")
        else:
            logger.warning(
                "VAST_AI_API_KEY not configured - requests will fail if server requires authentication")

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/process",
                    files=files_data,
                    data=form_data,
                    headers=headers
                )
                response.raise_for_status()
                result = response.json()
                logger.info(
                    f"Successfully sent {len(files)} document(s) to Vast.ai server"
                )
                return result

        except httpx.HTTPStatusError as e:
            error_msg = f"Vast.ai server error: {e.response.status_code}"
            if e.response.text:
                try:
                    error_detail = e.response.json()
                    error_msg += f" - {error_detail}"
                except (ValueError, KeyError) as json_error:
                    error_msg += f" - {e.response.text[:200]}"
                    logger.debug(f"JSON parsing error: {json_error}")
            logger.error(error_msg)
            raise httpx.HTTPStatusError(error_msg, request=e.request, response=e.response) from e
        except httpx.RequestError as e:
            error_msg = f"Failed to connect to Vast.ai server: {e}"
            logger.error(error_msg)
            raise httpx.RequestError(error_msg, request=e.request) from e

    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        Get status of a processing task.

        Args:
            task_id: Task ID returned from process_documents

        Returns:
            Task status dict
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/status/{task_id}")
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to get task status: {e}")
            raise
        except httpx.RequestError as e:
            logger.error(f"Failed to connect to Vast.ai server: {e}")
            raise

    async def close(self):
        """Close client (no-op for HTTP client)."""
        pass
