"""
Supabase Storage client for document operations.
"""
from pathlib import Path
from typing import Optional
import logging

from backend.config.database.supabase_client import get_supabase_client
from backend.config.settings import settings

logger = logging.getLogger(__name__)


class SupabaseStorageClient:
    """Client for Supabase Storage operations."""

    def __init__(self):
        self.bucket_name = settings.DOCUMENT_STORAGE_BUCKET
        self.supabase = get_supabase_client(use_service_role=True)

    def upload_file(
        self,
        file_content: bytes,
        file_path: str,
        content_type: str,
        user_id: Optional[str] = None
    ) -> str:
        """
        Upload file to Supabase Storage.

        Args:
            file_content: File content as bytes
            file_path: Storage path (e.g., "{user_id}/{document_id}/{filename}")
            content_type: MIME type
            user_id: User ID (optional, for logging)

        Returns:
            Storage path to file
        """
        try:
            # Upload file
            self.supabase.storage.from_(self.bucket_name).upload(
                path=file_path,
                file=file_content,
                file_options={"content-type": content_type}
            )

            logger.info(f"Uploaded file to: {file_path}")
            return file_path

        except Exception as e:
            logger.error(f"Error uploading file {file_path}: {e}")
            raise

    def download_file(self, file_path: str) -> bytes:
        """
        Download file from Supabase Storage.

        Args:
            file_path: Storage path to file

        Returns:
            File content as bytes
        """
        try:
            response = self.supabase.storage.from_(
                self.bucket_name).download(file_path)
            return response

        except Exception as e:
            logger.error(f"Error downloading file {file_path}: {e}")
            raise

    def delete_file(self, file_path: str) -> None:
        """
        Delete file from Supabase Storage.

        Args:
            file_path: Storage path to file
        """
        try:
            self.supabase.storage.from_(self.bucket_name).remove([file_path])
            logger.info(f"Deleted file: {file_path}")

        except Exception as e:
            logger.error(f"Error deleting file {file_path}: {e}")
            raise

    def get_file_url(self, file_path: str, expires_in: int = 3600) -> str:
        """
        Get signed URL for file access.

        Args:
            file_path: Storage path to file
            expires_in: URL expiration time in seconds (default: 1 hour)

        Returns:
            Signed URL for file access
        """
        try:
            response = self.supabase.storage.from_(self.bucket_name).create_signed_url(
                file_path,
                expires_in=expires_in
            )
            return response.get("signedURL", "")

        except Exception as e:
            logger.error(f"Error creating signed URL for {file_path}: {e}")
            raise

    def file_exists(self, file_path: str) -> bool:
        """
        Check if file exists in storage.

        Args:
            file_path: Storage path to file

        Returns:
            True if file exists, False otherwise
        """
        try:
            files = self.supabase.storage.from_(self.bucket_name).list(
                path=Path(file_path).parent.as_posix(
                ) if "/" in file_path else ""
            )

            filename = Path(file_path).name
            if files:
                return any(f.get("name") == filename for f in files)
            return False

        except Exception as e:
            logger.warning(f"Error checking file existence {file_path}: {e}")
            return False
