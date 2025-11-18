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
  onTypingChange?: (isTyping: boolean) => void
}

export function useChatSocketEvents({ socket, conversationId, onTypingChange }: UseChatSocketEventsProps) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!socket) return

    const handleMessage = (message: Message) => {
      queryClient.setQueryData<{ messages: Message[]; total: number }>(
        ['conversations', conversationId, 'messages'],
        (old) => {
          if (!old) {
            return { messages: [message], total: 1 }
          }
          const exists = old.messages.some((m) => m._id === message._id)
          if (exists) {
            return old
          }
          return {
            ...old,
            messages: [...old.messages, message],
            total: old.total + 1,
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
  }, [socket, conversationId, queryClient, onTypingChange])
}
