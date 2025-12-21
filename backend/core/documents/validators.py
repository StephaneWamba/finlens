"""File validation utilities for document uploads."""
from pathlib import Path
from typing import Tuple, Optional
import logging

from backend.config.settings import settings

logger = logging.getLogger(__name__)


class DocumentValidator:
    """Validator for document file uploads."""

    @staticmethod
    def validate_file(
        filename: str,
        file_size: int,
        content_type: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """Validate uploaded file."""
        # Check file extension
        file_path = Path(filename)
        extension = file_path.suffix.lower()

        if extension not in settings.DOCUMENT_SUPPORTED_EXTENSIONS:
            return False, f"Unsupported file type: {extension}. Supported: {', '.join(settings.DOCUMENT_SUPPORTED_EXTENSIONS)}"

        # Check file size
        max_size_bytes = settings.DOCUMENT_MAX_SIZE_MB * 1024 * 1024
        if file_size > max_size_bytes:
            return False, f"File too large: {file_size} bytes. Maximum: {max_size_bytes} bytes ({settings.DOCUMENT_MAX_SIZE_MB} MB)"

        if file_size == 0:
            return False, "File is empty"

        # Validate MIME type if provided
        if content_type:
            expected_mime_types = {
                '.pdf': ['application/pdf'],
                '.png': ['image/png'],
                '.jpg': ['image/jpeg'],
                '.jpeg': ['image/jpeg']
            }

            expected = expected_mime_types.get(extension, [])
            if expected and content_type not in expected:
                logger.warning(
                    f"MIME type mismatch: {content_type} for extension {extension}")
                # Don't fail, just warn (browsers sometimes send wrong MIME types)

        return True, None

    @staticmethod
    def get_mime_type(file_extension: str) -> str:
        """
        Get MIME type for file extension.

        Args:
            file_extension: File extension (e.g., '.pdf')

        Returns:
            MIME type string
        """
        mime_types = {
            '.pdf': 'application/pdf',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg'
        }

        return mime_types.get(file_extension.lower(), 'application/octet-stream')
