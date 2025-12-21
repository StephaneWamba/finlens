"""Document service for managing user documents."""
from typing import Optional, List, Dict, Any, Tuple
import logging
from datetime import datetime, timezone

from backend.config.database.supabase_client import get_supabase_client
from backend.core.documents.models import (
    Document, DocumentUpdate, DocumentStatus
)
from backend.core.documents.storage.supabase_storage import SupabaseStorageClient

logger = logging.getLogger(__name__)


class DocumentService:
    """Service for document management operations."""

    def __init__(self):
        # Use service role to bypass RLS for backend operations
        self.supabase = get_supabase_client(use_service_role=True)
        self.storage = SupabaseStorageClient()

    def create_document(
        self,
        user_id: str,
        filename: str,
        original_filename: str,
        file_extension: str,
        file_size: int,
        mime_type: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Document:
        """Create a new document record."""
        try:
            document_data = {
                "user_id": user_id,
                "filename": filename,
                "original_filename": original_filename,
                "file_extension": file_extension,
                "file_size": file_size,
                "mime_type": mime_type,
                "status": DocumentStatus.UPLOADED.value,
                "metadata": metadata or {}
            }

            result = self.supabase.table(
                "user_documents").insert(document_data).execute()

            if not result.data:
                raise ValueError("Failed to create document record")

            return Document(**result.data[0])

        except Exception as e:
            logger.error(f"Error creating document: {e}")
            raise

    def get_document(self, document_id: str, user_id: str) -> Optional[Document]:
        """Get document by ID (with user validation)."""
        try:
            result = self.supabase.table("user_documents").select("*").eq(
                "id", document_id
            ).eq("user_id", user_id).execute()

            if result.data:
                return Document(**result.data[0])
            return None

        except Exception as e:
            logger.error(f"Error getting document {document_id}: {e}")
            return None

    def list_documents(
        self,
        user_id: str,
        status: Optional[DocumentStatus] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[Document], int]:
        """List user's documents."""
        try:
            query = self.supabase.table("user_documents").select(
                "*", count="exact"
            ).eq("user_id", user_id)

            if status:
                query = query.eq("status", status.value)

            query = query.order("created_at", desc=True).range(
                offset, offset + limit - 1)
            result = query.execute()

            documents = [Document(**doc)
                         for doc in (result.data or [])]
            total = result.count if hasattr(
                result, 'count') and result.count is not None else len(documents)

            return documents, total

        except Exception as e:
            logger.error(f"Error listing documents for user {user_id}: {e}")
            return [], 0

    def update_document(
        self,
        document_id: str,
        user_id: str,
        update: DocumentUpdate
    ) -> Optional[Document]:
        """Update document status/metadata."""
        try:
            update_data = update.model_dump(exclude_unset=True)

            # Convert datetime objects to ISO strings for Supabase
            for key, value in update_data.items():
                if isinstance(value, datetime):
                    update_data[key] = value.isoformat()

            update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

            result = self.supabase.table("user_documents").update(update_data).eq(
                "id", document_id
            ).eq("user_id", user_id).execute()

            if result.data:
                return Document(**result.data[0])
            return None

        except Exception as e:
            logger.error(f"Error updating document {document_id}: {e}")
            return None

    def get_document_urls(
        self,
        document_id: str,
        user_id: str,
        expires_in: int = 3600
    ) -> Dict[str, Optional[str]]:
        """
        Get signed URL for original PDF.

        Args:
            document_id: Document ID
            user_id: User ID
            expires_in: URL expiration time in seconds (default: 1 hour)

        Returns:
            Dictionary with 'original_pdf_url'
        """
        try:
            document = self.get_document(document_id, user_id)
            if not document:
                return {"original_pdf_url": None}

            urls = {}

            # Generate original PDF URL
            if document.filename:
                original_path = f"{user_id}/{document_id}/{document.filename}"
                try:
                    urls["original_pdf_url"] = self.storage.get_file_url(
                        original_path, expires_in=expires_in
                    )
                except Exception as e:
                    logger.warning(f"Error generating original PDF URL: {e}")
                    urls["original_pdf_url"] = None

            return urls

        except Exception as e:
            logger.error(f"Error getting document URLs for {document_id}: {e}")
            return {"original_pdf_url": None}

    def delete_document(self, document_id: str, user_id: str) -> bool:
        """Delete document and associated files."""
        try:
            # Get document to find file paths
            document = self.get_document(document_id, user_id)
            if not document:
                return False

            # Delete from storage
            if document.filename:
                storage_path = f"{user_id}/{document_id}/{document.filename}"
                try:
                    self.storage.delete_file(storage_path)
                except Exception as e:
                    logger.warning(f"Error deleting file from storage: {e}")

            if document.content_list_path:
                try:
                    self.storage.delete_file(document.content_list_path)
                except Exception as e:
                    logger.warning(
                        f"Error deleting content_list from storage: {e}")

            # Delete embeddings from Qdrant
            try:
                from backend.core.ai.vector_db.qdrant_client import get_qdrant_client
                qdrant = get_qdrant_client()
                deleted_chunks = qdrant.delete_document_chunks(
                    document_id, user_id)
                logger.info(
                    f"Deleted {deleted_chunks} Qdrant chunks for document {document_id}")
            except Exception as e:
                logger.warning(
                    f"Error deleting Qdrant chunks for document {document_id}: {e}")
                # Continue with deletion even if Qdrant deletion fails

            # Delete from database
            self.supabase.table("user_documents").delete().eq(
                "id", document_id
            ).eq("user_id", user_id).execute()

            logger.info(f"Deleted document {document_id} for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error deleting document {document_id}: {e}")
            return False
