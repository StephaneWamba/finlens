/**
 * Chat API Client
 * React Query hooks for chat operations
 * 
 * @module lib/api/chat
 * @description Provides React Query hooks for managing conversations and messages
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { io, Socket } from 'socket.io-client'
import { useEffect, useRef, useState } from 'react'

export interface Conversation {
  _id: string
  agent_id: string
  company_id: string
  contact_id?: string
  user_id?: string
  channel: 'chat' | 'voice' | 'video' | 'email' | 'sms'
  status: 'active' | 'ended' | 'archived'
  started_at: string
  ended_at?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  threads?: Array<{
    id: string
    title: string
    created_at: string
    message_count?: number
  }>
  created_at: string
  updated_at: string
}

export interface Message {
  _id: string
  conversation_id: string
  thread_id?: string
  sender_type: 'user' | 'agent' | 'system'
  role: 'user' | 'assistant' | 'system'
  content: string
  message_type: 'text' | 'audio' | 'video' | 'file' | 'image' | 'system'
  attachments?: Array<{
    url: string
    type: string
    name: string
    size?: number
  }>
  ai_metadata?: {
    model?: string
    tokens_used?: number
    response_time_ms?: number
    temperature?: number
    finish_reason?: string
  }
  metadata?: {
    read_at?: string
    delivered_at?: string
    edited_at?: string
    reactions?: Array<{
      emoji: string
      user_id: string
      created_at: string
    }>
    intent?: {
      category: 'question' | 'complaint' | 'request' | 'purchase' | 'support' | 'feedback' | 'greeting' | 'goodbye' | 'other'
      confidence: number
      reasoning?: string
    }
    sentiment?: {
      sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
      score: number
      confidence: number
      emotions?: string[]
      reasoning?: string
    }
    [key: string]: unknown
  }
  created_at: string
}

export interface CreateConversationInput {
  agentId: string
  channel?: 'chat' | 'voice' | 'video' | 'email' | 'sms'
  metadata?: Record<string, unknown>
}

export interface SendMessageInput {
  conversationId: string
  content: string
  messageType?: 'text' | 'audio' | 'video' | 'file' | 'image'
  threadId?: string
  attachments?: Array<{
    url: string
    type: string
    name: string
    size?: number
  }>
}

// API functions
async function fetchConversations(params?: { status?: string; channel?: string; limit?: number; offset?: number }): Promise<{ conversations: Conversation[]; total: number }> {
  const queryParams = new URLSearchParams()
  if (params?.status) queryParams.append('status', params.status)
  if (params?.channel) queryParams.append('channel', params.channel)
  if (params?.limit) queryParams.append('limit', params.limit.toString())
  if (params?.offset) queryParams.append('offset', params.offset.toString())

  const response = await fetch(`/api/conversations?${queryParams.toString()}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch conversations' }))
    throw new Error(error.error || 'Failed to fetch conversations')
  }
  return await response.json()
}

async function fetchConversation(id: string): Promise<{ conversation: Conversation }> {
  const response = await fetch(`/api/conversations/${id}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch conversation' }))
    throw new Error(error.error || 'Failed to fetch conversation')
  }
  return await response.json()
}

async function fetchMessages(
  conversationId: string, 
  params?: { limit?: number; offset?: number; threadId?: string | null }
): Promise<{ messages: Message[]; total: number }> {
  const queryParams = new URLSearchParams()
  if (params?.limit) queryParams.append('limit', params.limit.toString())
  if (params?.offset) queryParams.append('offset', params.offset.toString())
  if (params?.threadId) queryParams.append('thread_id', params.threadId)

  const response = await fetch(`/api/conversations/${conversationId}/messages?${queryParams.toString()}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch messages' }))
    throw new Error(error.error || 'Failed to fetch messages')
  }
  return await response.json()
}

async function updateConversation(id: string, data: { status?: string; tags?: string[]; metadata?: Record<string, unknown> }): Promise<{ conversation: Conversation }> {
  const response = await fetch(`/api/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update conversation' }))
    throw new Error(error.error || 'Failed to update conversation')
  }
  return await response.json()
}

async function updateMessage(conversationId: string, messageId: string, data: { markAsRead?: boolean; reaction?: string | null }): Promise<{ message: Message }> {
  const response = await fetch(`/api/conversations/${conversationId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update message' }))
    throw new Error(error.error || 'Failed to update message')
  }
  return await response.json()
}

// React Query hooks
export function useConversations(params?: { status?: string; channel?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['conversations', params],
    queryFn: () => fetchConversations(params),
    staleTime: CACHE_TTL.MEDIUM, // 30 seconds
    keepPreviousData: true, // Keep previous data while loading new page
  })
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ['conversations', id],
    queryFn: () => fetchConversation(id),
    enabled: !!id,
  })
}

import { PAGINATION, CACHE_TTL } from '@/lib/constants/api'

export function useMessages(
  conversationId: string, 
  params?: { limit?: number; offset?: number; threadId?: string | null }
) {
  const cacheKey = [
    'conversations', 
    conversationId, 
    'messages', 
    params?.threadId || null,
    params?.limit,
    params?.offset,
  ]
  
  return useQuery({
    queryKey: cacheKey,
    queryFn: () => fetchMessages(conversationId, params),
    enabled: !!conversationId,
    staleTime: CACHE_TTL.LONG, // 1 minute for better performance
    refetchInterval: false, // Disable automatic refetching
    keepPreviousData: true, // Keep previous data while loading new page
  })
}

export function useUpdateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: string; tags?: string[]; metadata?: Record<string, unknown> } }) =>
      updateConversation(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversations', variables.id] })
      toast.success('Conversation updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update conversation')
    },
  })
}

export function useUpdateMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ conversationId, messageId, data }: { conversationId: string; messageId: string; data: { markAsRead?: boolean; reaction?: string | null } }) =>
      updateMessage(conversationId, messageId, data),
    onSuccess: (updatedMessage, variables) => {
      // Optimistically update the cache instead of invalidating (reduces refetches)
      queryClient.setQueryData<{ messages: Message[]; total: number }>(
        ['conversations', variables.conversationId, 'messages'],
        (old) => {
          if (!old) return old
          return {
            ...old,
            messages: old.messages.map((msg) =>
              msg._id === variables.messageId ? { ...msg, ...updatedMessage } : msg
            ),
          }
        }
      )
      // Only invalidate if it's a reaction (to get updated counts), not for read receipts
      if (variables.data.reaction !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['conversations', variables.conversationId, 'messages'] })
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update message')
    },
  })
}

/**
 * Socket.io hook for real-time chat
 * 
 * @param token - Authentication token for socket connection
 * @returns Object containing socket instance and connection status
 * 
 * @example
 * ```tsx
 * const { socket, isConnected } = useChatSocket(token)
 * 
 * useEffect(() => {
 *   if (socket && isConnected) {
 *     socket.emit('conversation:join', conversationId)
 *   }
 * }, [socket, isConnected, conversationId])
 * ```
 */
export function useChatSocket(token: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!token) return

    const CHAT_SERVICE_URL = process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || 'http://localhost:4004'

    // Create socket connection
    const newSocket = io(CHAT_SERVICE_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    })

    newSocket.on('connect', () => {
      setIsConnected(true)
    })

    newSocket.on('disconnect', () => {
      setIsConnected(false)
    })

    newSocket.on('error', () => {
      toast.error('Connection error. Please refresh the page.')
    })

    setSocket(newSocket)
    socketRef.current = newSocket

    return () => {
      newSocket.close()
      setSocket(null)
      setIsConnected(false)
    }
  }, [token])

  return { socket, isConnected }
}

