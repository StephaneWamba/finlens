'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { documentsService } from '@/lib/api/documents';
import { useToast } from '@/lib/utils/toast';
import type { BatchUploadResponse } from '@/types/api';

interface DocumentUploadProps {
  onUploadSuccess?: () => void;
  onUploadError?: (error: string) => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 10; // Maximum batch size
const STATUS_CLEAR_DELAY_MS = 5000; // 5 seconds
const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

interface FileWithDescription {
  file: File;
  description: string;
  id: string;
}

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  message?: string;
}

export function DocumentUpload({ onUploadSuccess, onUploadError }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filesWithDescriptions, setFilesWithDescriptions] = useState<FileWithDescription[]>([]);
  const [fileStatuses, setFileStatuses] = useState<FileUploadStatus[]>([]);
  const { success, error: showError } = useToast();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      setError(null);

      // Add new files to the list (don't upload yet)
      const newFiles: FileWithDescription[] = acceptedFiles.map(file => ({
        file,
        description: '',
        id: `${file.name}-${Date.now()}-${Math.random()}`,
      }));

      setFilesWithDescriptions(prev => {
        const combined = [...prev, ...newFiles];
        // Limit to MAX_FILES
        return combined.slice(0, MAX_FILES);
      });
    },
    []
  );

  const removeFile = useCallback((id: string) => {
    setFilesWithDescriptions(prev => prev.filter(f => f.id !== id));
  }, []);

  const updateDescription = useCallback((id: string, description: string) => {
    setFilesWithDescriptions(prev =>
      prev.map(f => (f.id === id ? { ...f, description } : f))
    );
  }, []);

  const handleUpload = useCallback(async () => {
    if (filesWithDescriptions.length === 0) return;

    setError(null);
    setUploading(true);

    // Initialize file statuses
    const initialStatuses: FileUploadStatus[] = filesWithDescriptions.map(({ file }) => ({
      file,
      status: 'uploading',
      }));
      setFileStatuses(initialStatuses);

      try {
      const response: BatchUploadResponse = await documentsService.uploadBatchWithDescriptions(
        filesWithDescriptions.map(({ file, description }) => ({ file, description }))
      );
          
          // Update statuses based on response
      const updatedStatuses: FileUploadStatus[] = filesWithDescriptions.map(({ file }, index) => {
            const result = response.results[index];
            return {
              file,
              status: result.status === 'failed' ? 'error' : 'success',
              message: result.message,
            };
          });
          setFileStatuses(updatedStatuses);

          if (response.successful > 0) {
            success(`${response.successful} of ${response.total} documents uploaded successfully.`);
            onUploadSuccess?.();
          }
          
          if (response.failed > 0) {
            showError(`${response.failed} document(s) failed to upload.`);
            onUploadError?.(`${response.failed} document(s) failed to upload.`);
          }

      // Clear files after successful upload
      if (response.successful > 0) {
        setTimeout(() => {
          setFilesWithDescriptions([]);
          setFileStatuses([]);
        }, STATUS_CLEAR_DELAY_MS);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to upload document(s)';
        setError(errorMessage);
        showError(errorMessage);
        onUploadError?.(errorMessage);
        
        // Mark all as error
        setFileStatuses(prev => prev.map(s => ({ ...s, status: 'error', message: errorMessage })));
      } finally {
        setUploading(false);
      }
  }, [filesWithDescriptions, onUploadSuccess, onUploadError, success, showError]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    disabled: uploading || filesWithDescriptions.length >= MAX_FILES,
    noClick: uploading,
  });

  const fileRejectionErrors = fileRejections.map(({ errors }) => errors).flat();

  return (
    <Card className="p-6">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50/50',
          uploading && 'opacity-50 cursor-not-allowed'
        )}
        aria-label="Upload document"
      >
        <input {...getInputProps()} aria-label="File input" />
        <div className="flex flex-col items-center gap-4">
          {uploading ? (
            <>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Upload className="h-6 w-6 text-blue-600 animate-pulse" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">Uploading...</p>
                <p className="text-xs text-gray-500">Please wait</p>
              </div>
            </>
          ) : (
            <>
              <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                <File className="h-6 w-6 text-gray-600" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">
                  {isDragActive ? 'Drop your file here' : 'Drag & drop your document here'}
                </p>
                <p className="text-xs text-gray-500">or click to browse</p>
                <p className="text-xs text-gray-400">
                  Supported: PDF, PNG, JPG (max 50MB per file, up to {MAX_FILES} files)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* File list with descriptions */}
      {filesWithDescriptions.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="text-sm font-medium text-gray-700">
            {filesWithDescriptions.length} file{filesWithDescriptions.length > 1 ? 's' : ''} selected
          </div>
          {filesWithDescriptions.map((fileWithDesc) => {
            const status = fileStatuses.find(s => s.file.name === fileWithDesc.file.name);
            return (
              <div
                key={fileWithDesc.id}
                className={cn(
                  'p-3 rounded-lg border',
                  status?.status === 'success' && 'bg-green-50 border-green-200',
                  status?.status === 'error' && 'bg-red-50 border-red-200',
                  status?.status === 'uploading' && 'bg-blue-50 border-blue-200',
                  !status && 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {status?.status === 'success' && (
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      )}
                      {status?.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      )}
                      {status?.status === 'uploading' && (
                        <Upload className="h-4 w-4 text-blue-600 flex-shrink-0 animate-pulse" />
                      )}
                      {!status && (
                        <File className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {fileWithDesc.file.name}
                      </span>
                      {!uploading && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-red-600 ml-auto"
                          onClick={() => removeFile(fileWithDesc.id)}
                          aria-label="Remove file"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Input
                      type="text"
                      placeholder="Enter document description (e.g., 'Apple 2024 10-K annual report')"
                      value={fileWithDesc.description}
                      onChange={(e) => updateDescription(fileWithDesc.id, e.target.value)}
                      disabled={uploading || !!status}
                      className="text-sm"
                    />
                    {status?.message && (
                      <p className="text-xs mt-1 text-gray-600">{status.message}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload button */}
      {filesWithDescriptions.length > 0 && !uploading && fileStatuses.length === 0 && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleUpload}
            disabled={filesWithDescriptions.length === 0}
            className="min-w-[120px]"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Batch
          </Button>
        </div>
      )}

      {/* File upload status list (during/after upload) */}
      {fileStatuses.length > 0 && filesWithDescriptions.length === 0 && (
        <div className="mt-4 space-y-2">
          {fileStatuses.map((fileStatus, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center gap-2 p-2 rounded text-sm',
                fileStatus.status === 'success' && 'bg-green-50 text-green-700',
                fileStatus.status === 'error' && 'bg-red-50 text-red-700',
                fileStatus.status === 'uploading' && 'bg-blue-50 text-blue-700',
                fileStatus.status === 'pending' && 'bg-gray-50 text-gray-700'
              )}
            >
              {fileStatus.status === 'success' && (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              )}
              {fileStatus.status === 'error' && (
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
              )}
              {fileStatus.status === 'uploading' && (
                <Upload className="h-4 w-4 flex-shrink-0 animate-pulse" />
              )}
              <span className="flex-1 truncate">{fileStatus.file.name}</span>
              {fileStatus.message && (
                <span className="text-xs opacity-75">{fileStatus.message}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {(error || fileRejectionErrors.length > 0) && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-sm text-red-700">
            {error ||
              fileRejectionErrors.map((err) => (
                <p key={err.code}>{err.message}</p>
              ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-red-600 hover:text-red-700"
            onClick={() => {
              setError(null);
            }}
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </Card>
  );
}

