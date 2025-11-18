'use client'

import { useState, useMemo, useEffect } from 'react'
import { useDocuments, useDeleteDocument, useSearchDocuments, type KnowledgeBaseDocument } from '@/lib/api/knowledge-base'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { FileUpload } from '@/components/knowledge-base/file-upload'
import dynamic from 'next/dynamic'

// Lazy load file viewer (heavy component with PDF support)
const FileViewer = dynamic(() => import('@/components/knowledge-base/file-viewer').then((mod) => ({ default: mod.FileViewer })), {
  ssr: false,
  loading: () => <div className="h-[600px] flex items-center justify-center">Loading file viewer...</div>,
})
import { Trash2, Search, Loader2, CheckCircle2, XCircle, Clock, BookOpen } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { formatDistanceToNow } from 'date-fns'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { getFileIcon, getFileIconColor } from '@/lib/utils/file-icons'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

const STATUS_COLORS = {
  pending: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  processing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  failed: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

const STATUS_ICONS = {
  pending: Clock,
  processing: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
}

import { DEBOUNCE_DELAYS } from '@/lib/constants'

const ITEMS_PER_PAGE = 10

export default function KnowledgeBasePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<KnowledgeBaseDocument | null>(null)
  const [useSemanticSearch, setUseSemanticSearch] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeBaseDocument | null>(null)
  
  const { data: documents, isLoading, error, refetch } = useDocuments()
  const deleteMutation = useDeleteDocument()
  const { data: searchResults, isLoading: isSearching } = useSearchDocuments(
    debouncedSearchQuery,
    undefined,
    10
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      setCurrentPage(1) // Reset to first page on search
    }, DEBOUNCE_DELAYS.SEARCH)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const documentScoreMap = useMemo(() => {
    if (!useSemanticSearch || !searchResults) {
      return new Map<string, number>()
    }

    const scoreMap = new Map<string, number>()
    for (const result of searchResults.results) {
      const docId = result.metadata?.document_id
      if (docId && typeof docId === 'string') {
        const currentScore = scoreMap.get(docId) || 0
        const resultScore = result.score || 0
        if (resultScore > currentScore) {
          scoreMap.set(docId, resultScore)
        }
      }
    }
    return scoreMap
  }, [searchResults, useSemanticSearch])

  const displayDocuments = useMemo(() => {
    if (!searchQuery.trim()) {
      return documents || []
    }

    if (useSemanticSearch && searchResults) {
      const resultDocumentIds = new Set(
        searchResults.results
          .map((r) => r.metadata?.document_id)
          .filter((id): id is string => Boolean(id))
      )
      
      const filtered = (documents || []).filter((doc) => resultDocumentIds.has(doc.id))
      
      const sorted = filtered.sort((a, b) => {
        const aScore = documentScoreMap.get(a.id) || 0
        const bScore = documentScoreMap.get(b.id) || 0
        return bScore - aScore
      })
      
      return sorted
    }

    return (documents || []).filter((doc) =>
      doc.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    )
  }, [documents, debouncedSearchQuery, useSemanticSearch, searchResults, documentScoreMap])

  // Pagination logic
  const totalPages = Math.ceil(displayDocuments.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedDocuments = displayDocuments.slice(startIndex, endIndex)

  useEffect(() => {
    // Reset to page 1 if current page is out of bounds
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [totalPages, currentPage])

  const handleDelete = async () => {
    if (!documentToDelete) return

    try {
      await deleteMutation.mutateAsync(documentToDelete.id)
      setDeleteDialogOpen(false)
      setDocumentToDelete(null)
    } catch (error) {
      // Error handled by mutation's onError callback
    }
  }

  const handleDoubleClick = (document: KnowledgeBaseDocument) => {
    setSelectedDocument(document)
    setViewerOpen(true)
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown'
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const renderPagination = () => {
    if (totalPages <= 1) return null

    const pages: (number | 'ellipsis')[] = []
    
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)
      
      if (currentPage > 3) {
        pages.push('ellipsis')
      }
      
      // Show pages around current
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }
      
      // Always show last page
      pages.push(totalPages)
    }

    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="gap-1 px-2.5 sm:pl-2.5"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              <span className="hidden sm:block">Previous</span>
            </Button>
          </PaginationItem>
          
          {pages.map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              )
            }
            
            return (
              <PaginationItem key={page}>
                <Button
                  variant={currentPage === page ? "outline" : "ghost"}
                  size="icon"
                  onClick={() => setCurrentPage(page)}
                  className="w-9"
                >
                  {page}
                </Button>
              </PaginationItem>
            )
          })}
          
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="gap-1 px-2.5 sm:pr-2.5"
            >
              <span className="hidden sm:block">Next</span>
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load documents. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground text-lg mt-1">
            Upload and manage documents for your AI agents
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <FileUpload onUploadComplete={() => refetch()} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Documents</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {displayDocuments.length} document{displayDocuments.length !== 1 ? 's' : ''} {searchQuery ? 'found' : 'uploaded'}
                </p>
              </div>
              {documents && documents.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={useSemanticSearch ? "Semantic search..." : "Search by name..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                  {debouncedSearchQuery && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUseSemanticSearch(!useSemanticSearch)}
                    >
                      {useSemanticSearch ? 'Semantic' : 'Name'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading || (debouncedSearchQuery && useSemanticSearch && isSearching) ? (
              <LoadingSkeleton />
            ) : !documents || documents.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No documents yet"
                description="Upload your first document to get started"
              />
            ) : displayDocuments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No documents found matching your search.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {paginatedDocuments.map((document, index) => {
                    const bestScore = documentScoreMap.get(document.id)
                    const searchResult = bestScore !== undefined
                      ? { score: bestScore }
                      : undefined
                    const StatusIcon = STATUS_ICONS[document.status]
                    const FileIcon = getFileIcon(document.name)
                    const iconColor = getFileIconColor(document.name)
                    
                    return (
                      <motion.div
                        key={document.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.03 }}
                        onDoubleClick={() => handleDoubleClick(document)}
                        className="group relative flex flex-col items-center p-6 border rounded-lg hover:bg-accent/50 hover:border-primary/50 transition-all cursor-pointer"
                      >
                        <div className={cn(
                          "rounded-xl bg-primary/10 p-6 mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all",
                          iconColor
                        )}>
                          <FileIcon className={cn("h-12 w-12", iconColor)} />
                        </div>
                        
                        <div className="w-full text-center space-y-2">
                          <p className="font-medium text-sm truncate w-full" title={document.name}>
                            {document.name}
                          </p>
                          
                          <div className="flex flex-col items-center gap-1.5">
                            {searchResult && (
                              <Badge variant="secondary" className="text-xs">
                                {(searchResult.score * 100).toFixed(0)}% match
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={cn(STATUS_COLORS[document.status], "text-xs")}
                            >
                              <StatusIcon
                                className={cn(
                                  "h-3 w-3 mr-1",
                                  document.status === 'processing' && 'animate-spin'
                                )}
                              />
                              {document.status}
                            </Badge>
                          </div>
                          
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <p>{formatFileSize(document.file_size)}</p>
                            <p>
                              {formatDistanceToNow(new Date(document.created_at), {
                                addSuffix: true,
                              })}
                            </p>
                            {(document.chunk_count > 0 || document.vector_count > 0) && (
                              <p className="text-[10px]">
                                {document.chunk_count > 0 && `${document.chunk_count} chunks`}
                                {document.chunk_count > 0 && document.vector_count > 0 && ' • '}
                                {document.vector_count > 0 && `${document.vector_count} vectors`}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDocumentToDelete(document)
                            setDeleteDialogOpen(true)
                          }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    )
                  })}
                </div>
                
                {renderPagination()}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <FileViewer
        document={selectedDocument}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{documentToDelete?.name}&quot;? This action cannot be undone
              and will also remove all associated chunks and vectors.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
