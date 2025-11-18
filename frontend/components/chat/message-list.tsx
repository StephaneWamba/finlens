'use client'

import { useEffect, useRef } from 'react'
import { MessageBubble } from './message-bubble'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { MessageSquare } from 'lucide-react'
import type { Message } from '@/lib/api/chat'

interface MessageListProps {
  messages: Message[]
  conversationId: string
  isLoading?: boolean
  currentUserId?: string
}

export function MessageList({ messages, conversationId, isLoading, currentUserId }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

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

