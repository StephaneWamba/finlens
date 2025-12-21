'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { DocumentList } from '@/components/documents/DocumentList';
import { DocumentViewer } from '@/components/documents/DocumentViewer';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queryKeys';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export default function DocumentsPage() {
  const [viewingDocumentId, setViewingDocumentId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleUploadSuccess = () => {
    // Invalidate documents list to refresh
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
  };

  const handleView = (documentId: string) => {
    setViewingDocumentId(documentId);
  };

  const handleCloseViewer = () => {
    setViewingDocumentId(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 lg:px-8 pt-6 pb-4 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Documents</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Upload and manage your financial documents
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="flex-shrink-0 px-4 sm:px-6 lg:px-8 py-4 bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto">
          <DocumentUpload onUploadSuccess={handleUploadSuccess} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4 sm:mb-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Your Documents</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Hover over a document and click "Open" to view it
            </p>
          </div>
          <DocumentList onView={handleView} compact={false} />
        </div>
      </div>

      {/* PDF Viewer Modal */}
      <Dialog open={!!viewingDocumentId} onOpenChange={(open) => !open && handleCloseViewer()}>
        <DialogContent 
          className="max-w-[85vw] w-full max-h-[90vh] h-[90vh] p-0 gap-0 flex flex-col"
          showCloseButton={true}
        >
          {viewingDocumentId && (
            <DocumentViewer
              documentId={viewingDocumentId}
              onClose={handleCloseViewer}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
