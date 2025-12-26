'use client';

import { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
// Try local worker first (from public folder), fallback to CDN
if (typeof window !== 'undefined') {
  // Prefer local worker (copied during build), fallback to CDN
  const localWorker = '/pdf.worker.min.mjs';
  const cdnWorker = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  
  // Try to verify local worker exists, fallback to CDN
  fetch(localWorker, { method: 'HEAD', cache: 'no-cache' })
    .then(() => {
      pdfjs.GlobalWorkerOptions.workerSrc = localWorker;
    })
    .catch(() => {
      // Local worker not available, use CDN
      pdfjs.GlobalWorkerOptions.workerSrc = cdnWorker;
    });
  
  // Set CDN as initial value (will be overridden if local exists)
  pdfjs.GlobalWorkerOptions.workerSrc = cdnWorker;
}

interface PDFViewerProps {
  readonly pdfUrl: string;
  readonly pageNumber?: number; // Optional now since we show all pages
  readonly onPageChange?: (page: number) => void; // Optional now
  className?: string;
}

export function PDFViewer({
  pdfUrl,
  className,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageWidth, setPageWidth] = useState<number>(800);

  useEffect(() => {
    const updatePageWidth = () => {
      if (containerRef.current) {
        // Use container width minus padding (32px = 2 * 16px for p-4)
        const containerWidth = containerRef.current.clientWidth - 32;
        // Set page width to 90% of container, max 1200px
        setPageWidth(Math.min(containerWidth * 0.9, 1200));
      }
    };

    updatePageWidth();
    globalThis.addEventListener('resize', updatePageWidth);
    return () => globalThis.removeEventListener('resize', updatePageWidth);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    setError(error.message || 'Failed to load PDF');
  };


  // Reset state when URL changes (using key prop on Document instead)

  return (
    <div className={cn('flex flex-col h-full w-full', className)}>
      {/* PDF Document - Scrollable with all pages */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-100 p-4" 
        style={{ 
          minHeight: 0, 
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 #f1f5f9'
        }}
      >
        {error ? (
          <div className="text-center p-4">
            <p className="text-sm text-red-600 mb-2">Failed to load PDF</p>
            <p className="text-xs text-gray-500">{error}</p>
            {pdfUrl && (
              <p className="text-xs text-gray-400 mt-2 break-all max-w-md">
                URL: {pdfUrl.substring(0, 100)}...
              </p>
            )}
          </div>
        ) : (
          <Document
            key={pdfUrl} // Force remount when URL changes to reset state
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <p className="text-sm text-gray-500">Loading PDF...</p>
              </div>
            }
            className="w-full"
            options={{
              httpHeaders: {
                'Accept': 'application/pdf',
              },
              withCredentials: false,
              standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
            }}
          >
            {numPages ? (
              <div className="flex flex-col items-center gap-4 w-full">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <div key={pageNum} className="flex flex-col items-center w-full">
                    <div className="w-full flex justify-center">
                      <Page
                        pageNumber={pageNum}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="shadow-lg"
                        width={pageWidth}
                        loading={
                          <div className="flex flex-col items-center gap-2 min-h-[400px] justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                            <p className="text-sm text-gray-500">Loading page {pageNum}...</p>
                          </div>
                        }
                      />
                    </div>
                    {numPages > 1 && (
                      <p className="text-xs text-gray-500 mt-2">Page {pageNum} of {numPages}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <p className="text-sm text-gray-500">Loading PDF...</p>
              </div>
            )}
          </Document>
        )}
      </div>
    </div>
  );
}

