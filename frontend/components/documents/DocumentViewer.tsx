'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PDFViewer } from './PDFViewer';
import { documentsService } from '@/lib/api/documents';
import { queryKeys } from '@/lib/api/queryKeys';
import { cn } from '@/lib/utils';

interface DocumentViewerProps {
  documentId: string | null;
  onClose: () => void;
}

export function DocumentViewer({ documentId, onClose }: DocumentViewerProps) {

  const { data: document, isLoading, error } = useQuery({
    queryKey: queryKeys.documents.detail(documentId || ''),
    queryFn: () => documentsService.get(documentId!),
    enabled: !!documentId,
    staleTime: 30000, // 30 seconds
  });


  if (!documentId) return null;

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 flex-shrink-0" />
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
            {isLoading ? 'Loading...' : document?.original_filename || 'Document'}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close viewer"
          className="flex-shrink-0 ml-2"
        >
          <X className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </div>

      {/* PDF Viewers - Responsive Layout */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Skeleton className="h-[600px] w-full max-w-4xl" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-red-600">Failed to load document</p>
        </div>
      ) : !document?.original_pdf_url ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-gray-500">PDF not available</p>
        </div>
      ) : (
        <div className="flex flex-col overflow-hidden bg-white flex-1 min-h-0 h-full">
          <div className="flex-1 min-h-0 overflow-hidden h-full">
            <PDFViewer
              pdfUrl={document.original_pdf_url}
              className="h-full w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}

