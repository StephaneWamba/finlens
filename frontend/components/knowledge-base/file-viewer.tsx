'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Download, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KnowledgeBaseDocument } from '@/lib/api/knowledge-base'

function TextViewer({ url, fileName }: { url: string; fileName: string }) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (url) {
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load file')
          return res.text()
        })
        .then((text) => {
          setContent(text)
          setLoading(false)
        })
        .catch((err) => {
          setError(err.message)
          setLoading(false)
        })
    }
  }, [url])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  const extension = fileName.split('.').pop()?.toLowerCase() || ''
  const isCode = ['md', 'csv'].includes(extension)

  return (
    <div className="h-[600px] overflow-auto border rounded-lg bg-muted/50">
      <pre className={cn(
        "p-4 text-sm font-mono whitespace-pre-wrap break-words",
        isCode && "bg-background"
      )}>
        {content}
      </pre>
    </div>
  )
}

interface FileViewerProps {
  document: KnowledgeBaseDocument | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FileViewer({ document: selectedDocument, open, onOpenChange }: FileViewerProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && selectedDocument) {
      loadFile()
    } else {
      setFileUrl(null)
      setError(null)
    }
  }, [open, selectedDocument])

  const loadFile = async () => {
    if (!selectedDocument) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/knowledge-base/${selectedDocument.id}/view`)
      if (!response.ok) {
        throw new Error('Failed to load file')
      }

      const data = await response.json()
      setFileUrl(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (fileUrl && selectedDocument) {
      const link = window.document.createElement('a')
      link.href = fileUrl
      link.download = selectedDocument.name
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
    }
  }

  const getFileExtension = (fileName: string) => {
    return fileName.split('.').pop()?.toLowerCase() || ''
  }

  const renderFileContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={loadFile} variant="outline">
              Retry
            </Button>
          </div>
        </div>
      )
    }

    if (!fileUrl || !selectedDocument) return null

    const extension = getFileExtension(selectedDocument.name || '')
    const mimeType = selectedDocument.mime_type || ''

    // PDF viewer
    if (extension === 'pdf' || mimeType === 'application/pdf') {
      return (
        <iframe
          src={fileUrl}
          className="w-full h-[600px] border rounded-lg"
          title={selectedDocument.name}
        />
      )
    }

    // Text files (TXT, MD, CSV) - fetch and display as text
    if (
      ['txt', 'md', 'csv'].includes(extension) ||
      mimeType.startsWith('text/')
    ) {
      return <TextViewer url={fileUrl} fileName={selectedDocument.name || ''} />
    }

    // DOC/DOCX - show download option
    if (['doc', 'docx'].includes(extension)) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              Preview not available for Word documents
            </p>
            <Button onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" />
              Download File
            </Button>
          </div>
        </div>
      )
    }

    // Fallback
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Preview not available</p>
          <Button onClick={handleDownload} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download File
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate pr-4">
              {selectedDocument?.name || 'File Viewer'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {fileUrl && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleDownload}
                  className="shrink-0"
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto mt-4">{renderFileContent()}</div>
      </DialogContent>
    </Dialog>
  )
}

