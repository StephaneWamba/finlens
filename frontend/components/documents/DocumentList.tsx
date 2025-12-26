'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Eye, Trash2, Calendar, AlertTriangle, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { DocumentStatusBadge } from './DocumentStatusBadge';
import { documentsService } from '@/lib/api/documents';
import { queryKeys } from '@/lib/api/queryKeys';
import type { Document } from '@/types/api';
import { useToast } from '@/lib/utils/toast';
import { cn } from '@/lib/utils';

interface DocumentListProps {
  readonly onView?: (documentId: string) => void;
  readonly compact?: boolean; // Compact mode for sidebar (single column list)
}

const MAX_POLL_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const POLL_INTERVAL_MS = 5000; // 5 seconds
const DOCUMENTS_PER_PAGE = 12; // Grid: 3 columns x 4 rows

export function DocumentList({ onView }: DocumentListProps) {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pollStartTimeRef = useRef<number | null>(null);

  // Fetch documents with auto-refresh for processing documents
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...queryKeys.documents.list(), currentPage],
    queryFn: () => documentsService.list(undefined, DOCUMENTS_PER_PAGE, (currentPage - 1) * DOCUMENTS_PER_PAGE),
    refetchInterval: (query) => {
      // Auto-refresh every 5 seconds if there are processing documents
      const documents = query.state.data?.documents || [];
      const hasProcessing = documents.some(
        (doc) => !['indexed', 'failed'].includes(doc.status)
      );

      if (hasProcessing) {
        // Start tracking poll time if not already started
        if (pollStartTimeRef.current === null) {
          pollStartTimeRef.current = Date.now();
        }

        // Check if we've exceeded maximum poll duration
        const elapsed = Date.now() - pollStartTimeRef.current;
        if (elapsed > MAX_POLL_DURATION_MS) {
          // Stop polling after 30 minutes
          pollStartTimeRef.current = null;
          return false;
        }

        return POLL_INTERVAL_MS;
      } else {
        // Reset poll timer when no processing documents
        pollStartTimeRef.current = null;
        return false;
      }
    },
    staleTime: 0, // Always consider stale to allow refetch
  });

  const totalPages = data ? Math.ceil(data.total / DOCUMENTS_PER_PAGE) : 1;

  // Reset to page 1 when total changes (e.g., after deletion)
  useEffect(() => {
    if (data?.total !== undefined && totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [data?.total, totalPages, currentPage]);

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => documentsService.delete(documentId),
    onSuccess: () => {
      success('Document deleted successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to delete document');
    },
  });

  const handleDeleteClick = (document: Document) => {
    setDocumentToDelete(document);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return;

    setDeleteDialogOpen(false);
    setDeletingId(documentToDelete.id);
    try {
      await deleteMutation.mutateAsync(documentToDelete.id);
    } finally {
      setDeletingId(null);
      setDocumentToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDocumentToDelete(null);
  };

  const handleView = (documentId: string) => {
    onView?.(documentId);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top when page changes
    globalThis.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: DOCUMENTS_PER_PAGE }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col items-center p-6">
                <Skeleton className="h-24 w-24 rounded-lg mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-gray-600 mb-4">
            Failed to load documents. Please try again.
          </p>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const documents = data?.documents || [];

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-sm font-medium text-gray-900 mb-1">
            No documents yet
          </p>
          <p className="text-xs text-gray-500">
            Upload your first document to get started
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Documents Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
        {documents.map((document) => (
          <Card
            key={document.id}
            className={cn(
              'group relative overflow-hidden transition-all hover:shadow-lg hover:scale-[1.02]',
              deletingId === document.id && 'opacity-50 pointer-events-none'
            )}
          >
            <CardContent className="p-0">
              {/* Document Icon - Fixed aspect ratio */}
              <div className="flex flex-col items-center p-4 sm:p-6 pb-4 bg-gradient-to-br from-gray-50 to-white">
                <div className="relative mb-3 sm:mb-4 w-full flex justify-center">
                  <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow flex-shrink-0">
                    <File className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1">
                    <DocumentStatusBadge status={document.status} />
                  </div>
                </div>

                {/* Document Name */}
                <h3 className="text-xs sm:text-sm font-semibold text-gray-900 text-center mb-2 line-clamp-2 min-h-[2.5rem] px-2">
                  {document.original_filename}
                </h3>

                {/* Document Metadata */}
                <div className="flex flex-col items-center gap-1 text-xs text-gray-500 mb-3 sm:mb-4">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <time dateTime={document.created_at}>
                      {formatDistanceToNow(new Date(document.created_at), {
                        addSuffix: true,
                      })}
                    </time>
                  </div>
                  {document.page_count && (
                    <span>{document.page_count} pages</span>
                  )}
                  <span>{(document.file_size / 1024 / 1024).toFixed(2)} MB</span>
                </div>

                {document.error_message && (
                  <p className="text-xs text-red-600 text-center mb-3 sm:mb-4 px-2 line-clamp-2">
                    {document.error_message}
                  </p>
                )}

                {/* Action Buttons - Only visible on hover */}
                <div className="flex items-center gap-2 w-full px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {document.original_pdf_url ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleView(document.id)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm"
                      aria-label={`Open ${document.original_filename}`}
                    >
                      <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Open
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="flex-1 text-xs sm:text-sm"
                    >
                      <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Not Available
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(document)}
                    disabled={deletingId === document.id}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 h-8 w-8 sm:h-9 sm:w-9 p-0"
                    aria-label={`Delete ${document.original_filename}`}
                  >
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center pt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle>Delete Document</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-gray-900">
                &quot;{documentToDelete?.original_filename}&quot;
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleDeleteCancel}
              disabled={deletingId === documentToDelete?.id}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deletingId === documentToDelete?.id}
            >
              {deletingId === documentToDelete?.id ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

