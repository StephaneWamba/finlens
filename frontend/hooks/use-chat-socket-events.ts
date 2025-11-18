/**
 * useChatSocketEvents Hook
 * Handles all Socket.io event listeners for chat functionality
 * 
 * @param socket - Socket.io instance
 * @param conversationId - Current conversation ID
 * @param queryClient - React Query client for cache updates
 * @param onTypingChange - Callback for typing indicator changes
 */

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Message } from '@/lib/api/chat'
import type { Socket } from 'socket.io-client'

interface UseChatSocketEventsProps {
  socket: Socket | null
  conversationId: string
  threadId?: string | null
  onTypingChange?: (isTyping: boolean) => void
}

export function useChatSocketEvents({ socket, conversationId, threadId, onTypingChange }: UseChatSocketEventsProps) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!socket) return

    const handleMessage = (message: Message) => {
      const messageThreadId = message.thread_id || null
      
      queryClient.setQueriesData<{ messages: Message[]; total: number }>(
        {
          queryKey: ['conversations', conversationId, 'messages', messageThreadId],
          exact: false,
        },
        (old) => {
          if (!old) {
            return { messages: [message], total: 1 }
          }
          // Remove any temporary messages with the same content (optimistic update replacement)
          const filteredMessages = old.messages.filter((m) => 
            !m._id.startsWith('temp-') || m.content !== message.content
          )
          const exists = filteredMessages.some((m) => m._id === message._id)
          if (exists) {
            return old
          }
          return {
            ...old,
            messages: [...filteredMessages, message],
            total: filteredMessages.length + 1,
          }
        }
      )
    }

    const handleTyping = (data: { userId: string; conversationId: string; isTyping: boolean }) => {
      if (data.conversationId === conversationId) {
        onTypingChange?.(data.isTyping)
      }
    }

    const handleError = (error: { message: string }) => {
      toast.error(error.message || 'An error occurred')
    }

    socket.on('message', handleMessage)
    socket.on('typing', handleTyping)
    socket.on('error', handleError)

    return () => {
      socket.off('message', handleMessage)
      socket.off('typing', handleTyping)
      socket.off('error', handleError)
    }
  }, [socket, conversationId, threadId, queryClient, onTypingChange])
}
