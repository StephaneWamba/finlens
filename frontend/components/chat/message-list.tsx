'use client'

import { useEffect, useRef } from 'react'
import { MessageBubble } from './message-bubble'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { Button } from '@/components/ui/button'
import { MessageSquare, ChevronUp, Loader2 } from 'lucide-react'
import type { Message } from '@/lib/api/chat'

interface MessageListProps {
  messages: Message[]
  conversationId: string
  isLoading?: boolean
  currentUserId?: string
  total?: number
  hasMore?: boolean
  onLoadMore?: () => void
  isLoadingMore?: boolean
}

export function MessageList({ 
  messages, 
  conversationId, 
  isLoading, 
  currentUserId,
  total,
  hasMore,
  onLoadMore,
  isLoadingMore
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const previousMessageCount = useRef(messages.length)

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive (only if new messages were added at the end)
    if (containerRef.current && messages.length > previousMessageCount.current) {
      const wasAtBottom = containerRef.current.scrollHeight - containerRef.current.scrollTop - containerRef.current.clientHeight < 100
      if (wasAtBottom) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
      }
    }
    previousMessageCount.current = messages.length
  }, [messages.length])

  if (isLoading) {
    return (
      <div className="flex-1 h-full overflow-y-auto">
        <div className="p-6">
          <LoadingSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="flex-1 h-full overflow-y-auto overflow-x-hidden"
    >
      <div className="p-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Start the conversation by sending a message below
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {hasMore && onLoadMore && (
              <div className="flex justify-center py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading older messages...
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Load older messages
                      {total !== undefined && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({total - messages.length} remaining)
                        </span>
                      )}
                    </>
                  )}
                </Button>
              </div>
            )}
            {messages.map((message) => (
              <MessageBubble
                key={message._id}
                message={message}
                conversationId={conversationId}
                isOwn={message.sender_type === 'user'}
              />
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </div>
    </div>
  )
}

