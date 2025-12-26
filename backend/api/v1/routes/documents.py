"""
Document management API endpoints.
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Query, Form, Request
from typing import Optional, List
from uuid import UUID
import logging
import json
import asyncio
from datetime import datetime, timezone

from backend.core.auth.dependencies import get_current_user
from backend.core.documents.service import DocumentService
from backend.core.documents.processing.vast_ai_client import VastAIClient
from backend.core.documents.models import DocumentStatus, DocumentUpdate, Document
from backend.core.documents.validators import DocumentValidator
from backend.api.v1.schemas.documents import (
    DocumentUploadResponse, DocumentResponse, DocumentListResponse,
    DocumentDeleteResponse, BatchUploadResponse
)
from backend.core.documents.models import DocumentMetadata
from backend.core.documents.metadata_extractor import MetadataExtractor
from backend.config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


async def _process_single_file(
    file: UploadFile,
    user_id: str,
    service: DocumentService,
    validator: DocumentValidator,
    metadata: Optional[DocumentMetadata] = None
) -> DocumentUploadResponse:
    """Process a single file upload."""
    # Validate file
    file_extension = f".{file.filename.split('.')[-1].lower()}" if '.' in file.filename else ""

    # Read file content
    content = await file.read()
    file_size = len(content)

    # Validate file
    is_valid, error_message = validator.validate_file(
        filename=file.filename or "unknown",
        file_size=file_size,
        content_type=file.content_type
    )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message
        )

    # Get MIME type
    mime_type = file.content_type or validator.get_mime_type(file_extension)

    # Extract metadata if not provided (for consistency with batch upload flow)
    if metadata is None:
        metadata = _extract_metadata(
            description=None,  # No description in single file path
            filename=file.filename
        )

    # Convert metadata to dict (exclude None values)
    metadata_dict = {}
    if metadata:
        metadata_dict = metadata.model_dump(exclude_none=True)

    # Create document record with metadata
    document = service.create_document(
        user_id=user_id,
        filename=file.filename or "document",
        original_filename=file.filename or "document",
        file_extension=file_extension,
        file_size=file_size,
        mime_type=mime_type,
        metadata=metadata_dict
    )

    # Upload to storage
    storage_path = f"{user_id}/{document.id}/{file.filename}"
    try:
        service.storage.upload_file(
            file_content=content,
            file_path=storage_path,
            content_type=mime_type,
            user_id=user_id
        )
        logger.info(
            f"Document uploaded to storage: {document.id} by user {user_id}")
    except Exception as e:
        error_msg = str(e)
        logger.error(
            f"Failed to upload file to Supabase Storage: {error_msg}", exc_info=True)
        # Check if it's a billing error
        if "403" in error_msg or "billing" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Supabase Storage requires billing to be enabled. Please enable billing in your Supabase project settings."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file to storage: {error_msg}"
        )

    # Send to Vast.ai for processing
    vast_ai_client = None
    try:
        logger.info(f"About to send document {document.id} to Vast.ai server")
        # Send file to Vast.ai server
        vast_ai_client = VastAIClient()
        file_content_bytes = content  # File is already in memory
        logger.info(f"VastAI client created, sending document {document.id}")
        result = await vast_ai_client.process_documents(
            files=[file_content_bytes],
            filenames=[file.filename or "document"],
            user_id=user_id,
            document_ids=[str(document.id)],
            metadatas=[metadata_dict] if metadata_dict else None,
            upload_to_storage=False,  # content_list.json not used, save storage space
            index=True
        )
        logger.info(f"Successfully sent document {document.id} to Vast.ai server: {result}")
    except Exception as e:
        logger.error(
            f"Failed to send document to Vast.ai: {e}", exc_info=True)
        # Log the full exception details
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        # Update status to failed if processing fails to start
        service.update_document(
            str(document.id),
            user_id,
            DocumentUpdate(
                status=DocumentStatus.FAILED,
                error_message=f"Failed to send document to Vast.ai: {str(e)}"
            )
        )
        # Return failed response - document uploaded but processing failed to start
        return DocumentUploadResponse(
            document_id=document.id,
            status="failed",
            message=f"Document uploaded but processing failed to start: {str(e)}",
            metadata=metadata_dict
        )
    finally:
        if vast_ai_client:
            await vast_ai_client.close()

    return DocumentUploadResponse(
        document_id=document.id,
        status=document.status.value,
        message="Document uploaded successfully. Processing queued.",
        metadata=metadata_dict
    )


def _extract_metadata(
    description: Optional[str],
    filename: Optional[str]
) -> Optional[DocumentMetadata]:
    """
    Extract document metadata from description or filename.

    Priority: AI extraction from description > filename extraction

    Args:
        description: Natural language description
        filename: Filename as hint

    Returns:
        DocumentMetadata or None
    """
    extractor = MetadataExtractor()

    # AI extraction from description
    if description:
        try:
            parsed_metadata = extractor.extract_from_description(description)
            logger.info("Extracted metadata from description using AI")
            return parsed_metadata
        except Exception as e:
            logger.error(f"AI metadata extraction failed: {e}", exc_info=True)
            # Fall back to filename extraction

    # Fallback: extract from filename
    if filename:
        try:
            parsed_metadata = extractor.extract_from_filename(filename)
            logger.info("Extracted metadata from filename")
            return parsed_metadata
        except Exception as e:
            logger.error(
                f"Filename metadata extraction failed: {e}", exc_info=True)

    return None


@router.post("/upload", response_model=BatchUploadResponse)
async def upload_document(
    files: List[UploadFile] = File(...),
    descriptions: Optional[str] = Form(
        None, description="JSON array of descriptions, one per file (e.g., ['Apple 2024 10-K', 'Tesla 2023 Q3 earnings'])"),
    current_user: dict = Depends(get_current_user)
):
    """Upload one or more documents for processing with per-document descriptions."""
    try:
        # FastAPI always provides a list, even for single file
        files_list = files if isinstance(files, list) else [files]

        # Validate batch size
        if len(files_list) > settings.DOCUMENT_MAX_BATCH_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum batch size is {settings.DOCUMENT_MAX_BATCH_SIZE} files. Received {len(files_list)} files."
            )

        service = DocumentService()
        validator = DocumentValidator()

        # Parse descriptions array
        descriptions_list: List[Optional[str]] = []
        if descriptions:
            try:
                descriptions_list = json.loads(descriptions)
                if not isinstance(descriptions_list, list):
                    raise ValueError("descriptions must be a JSON array")
                # Pad or truncate to match file count
                if len(descriptions_list) < len(files_list):
                    descriptions_list.extend(
                        [None] * (len(files_list) - len(descriptions_list)))
                elif len(descriptions_list) > len(files_list):
                    descriptions_list = descriptions_list[:len(files_list)]
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(
                    f"Invalid descriptions JSON: {e}. Using empty descriptions.")
                descriptions_list = [None] * len(files_list)
        else:
            descriptions_list = [None] * len(files_list)

        # Process each file: upload to Supabase, extract metadata, then send to Vast.ai
        async def process_file_with_description(file: UploadFile, file_description: Optional[str]):
            """Process a single file: upload to Supabase, extract metadata, send to Vast.ai."""
            # Reset file pointer for validation (file may have been read already)
            await file.seek(0)

            # Extract metadata from description or filename
            parsed_metadata = _extract_metadata(
                description=file_description,
                filename=file.filename
            )

            # Process file (uploads to Supabase, creates document record, sends to Vast.ai)
            return await _process_single_file(
                file, current_user["id"], service, validator, metadata=parsed_metadata
            )

        # Process all files in parallel (each with its own metadata)
        results_data = await asyncio.gather(*[
            process_file_with_description(file, descriptions_list[i])
            for i, file in enumerate(files_list)
        ], return_exceptions=True)

        # Process results
        results = []
        successful = 0
        failed = 0

        for result_data in results_data:
            if isinstance(result_data, Exception):
                # Exception occurred during processing
                failed += 1
                error_msg = str(result_data)
                if isinstance(result_data, HTTPException):
                    error_msg = result_data.detail
                results.append(DocumentUploadResponse(
                    document_id=UUID('00000000-0000-0000-0000-000000000000'),
                    status="failed",
                    message=error_msg
                ))
                logger.error(
                    f"Exception during parallel file processing: {result_data}", exc_info=True)
            else:
                result = result_data
                results.append(result)
                if result.status != "failed":
                    successful += 1
                else:
                    failed += 1

        # Always return batch response
        return BatchUploadResponse(
            total=len(files_list),
            successful=successful,
            failed=failed,
            results=results
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document(s): {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload document(s): {str(e)}"
        )


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    status_filter: Optional[DocumentStatus] = Query(
        None, alias="status", description="Filter by status"),
    limit: int = Query(
        50, ge=1, le=100, description="Maximum number of documents"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user: dict = Depends(get_current_user)
):
    """List user's documents."""
    try:
        service = DocumentService()
        documents, total = service.list_documents(
            user_id=current_user["id"],
            status=status_filter,
            limit=limit,
            offset=offset
        )

        # Get PDF URLs for each document
        document_responses = []
        for doc in documents:
            doc_dict = doc.model_dump()
            urls = service.get_document_urls(str(doc.id), current_user["id"])
            doc_dict["original_pdf_url"] = urls.get("original_pdf_url")
            document_responses.append(DocumentResponse(**doc_dict))

        return DocumentListResponse(
            documents=document_responses,
            total=total,
            limit=limit,
            offset=offset
        )

    except Exception as e:
        logger.error(f"Error listing documents: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list documents: {str(e)}"
        )


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Get document by ID with PDF URLs."""
    try:
        service = DocumentService()
        document = service.get_document(str(document_id), current_user["id"])

        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )

        # Get PDF URLs
        urls = service.get_document_urls(str(document_id), current_user["id"])

        # Build response with URLs
        doc_dict = document.model_dump()
        doc_dict["original_pdf_url"] = urls.get("original_pdf_url")

        return DocumentResponse(**doc_dict)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get document: {str(e)}"
        )


@router.delete("/{document_id}", response_model=DocumentDeleteResponse)
async def delete_document(
    document_id: UUID,
    current_user: dict = Depends(get_current_user)
):
    """Delete document and associated files."""
    try:
        service = DocumentService()
        success = service.delete_document(str(document_id), current_user["id"])

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )

        logger.info(
            f"Document deleted: {document_id} by user {current_user['id']}")

        return DocumentDeleteResponse(
            message="Document deleted successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document: {str(e)}"
        )


@router.post("/webhook/vast-ai", status_code=status.HTTP_200_OK)
async def vast_ai_webhook(request: Request):
    """
    Webhook endpoint to receive task completion notifications from Vast.ai server.

    Expected payload:
    {
        "task_id": "uuid",
        "status": "completed" | "failed",
        "result": {
            "success": true,
            "document_id": "uuid",
            "content_list_path": "path/to/content_list.json",
            "page_count": 100,
            "elements_count": 500,
            "chunks_indexed": 250,
            "processing_time_seconds": 45.2,
            "filename": "document.pdf"
        },
        "error": "error message" (only if status is "failed")
    }
    """
    try:
        logger.info("Received webhook request from Vast.ai server")
        # Parse JSON payload
        payload = await request.json()
        logger.info(
            f"Webhook payload: task_id={payload.get('task_id')}, status={payload.get('status')}")

        # Extract payload fields
        task_id = payload.get("task_id")
        status_str = payload.get("status")
        result = payload.get("result")
        error = payload.get("error")

        if not task_id:
            logger.warning("Webhook received without task_id")
            return {"status": "error", "message": "task_id is required"}

        if status_str not in ["completed", "failed"]:
            logger.warning(
                f"Webhook received with invalid status: {status_str}")
            return {"status": "error", "message": "status must be 'completed' or 'failed'"}

        # Get document_id from result or error context
        document_id = None
        if result and isinstance(result, dict):
            document_id = result.get("document_id")
        elif error and isinstance(error, dict):
            document_id = error.get("document_id")

        if not document_id:
            logger.warning(
                f"Webhook received without document_id for task {task_id}")
            return {"status": "error", "message": "document_id is required"}

        # Initialize service
        service = DocumentService()

        # Get document to find user_id (needed for update)
        # We'll need to find it differently
        try:
            # Try to get document directly from database (bypass user_id check for webhooks)
            result_query = service.supabase.table("user_documents").select(
                "*").eq("id", document_id).execute()
            if result_query.data:
                document = Document(**result_query.data[0])
            else:
                logger.error(
                    f"Document {document_id} not found for webhook task {task_id}")
                return {"status": "error", "message": f"Document {document_id} not found"}
        except Exception as e:
            logger.error(f"Error fetching document {document_id}: {e}")
            return {"status": "error", "message": f"Error fetching document: {str(e)}"}
        if not document:
            # Try to get document without user_id check (service role can do this)
            try:
                result_query = service.supabase.table("user_documents").select(
                    "*").eq("id", document_id).execute()
                if result_query.data:
                    document = Document(**result_query.data[0])
                else:
                    logger.error(
                        f"Document {document_id} not found for webhook task {task_id}")
                    return {"status": "error", "message": f"Document {document_id} not found"}
            except Exception as e:
                logger.error(f"Error fetching document {document_id}: {e}")
                return {"status": "error", "message": f"Error fetching document: {str(e)}"}

        user_id = str(document.user_id)

        # Update document based on status
        if status_str == "completed" and result:
            update_data = DocumentUpdate(
                status=DocumentStatus.INDEXED,
                page_count=result.get("page_count"),
                content_list_path=result.get("content_list_path"),
                processing_completed_at=datetime.now(timezone.utc),
                indexed_at=datetime.now(timezone.utc)
            )
            updated_doc = service.update_document(
                document_id, user_id, update_data)
            if updated_doc:
                logger.info(
                    f"Document {document_id} updated to INDEXED via webhook. "
                    f"Pages: {result.get('page_count')}, Chunks: {result.get('chunks_indexed')}"
                )
                return {"status": "success", "message": "Document updated successfully"}
            else:
                logger.error(
                    f"Failed to update document {document_id} to INDEXED")
                return {"status": "error", "message": "Failed to update document"}

        elif status_str == "failed":
            error_message = error if isinstance(error, str) else str(
                error) if error else "Processing failed"
            update_data = DocumentUpdate(
                status=DocumentStatus.FAILED,
                error_message=error_message,
                processing_completed_at=datetime.now(timezone.utc)
            )
            updated_doc = service.update_document(
                document_id, user_id, update_data)
            if updated_doc:
                logger.info(
                    f"Document {document_id} updated to FAILED via webhook: {error_message}")
                return {"status": "success", "message": "Document status updated to failed"}
            else:
                logger.error(
                    f"Failed to update document {document_id} to FAILED")
                return {"status": "error", "message": "Failed to update document"}

        return {"status": "success", "message": "Webhook processed"}

    except Exception as e:
        logger.error(f"Error processing Vast.ai webhook: {e}", exc_info=True)
        return {"status": "error", "message": f"Internal error: {str(e)}"}
