'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { MessageList } from './message-list'
import { MessageInput } from './message-input'
import { TypingIndicator } from './typing-indicator'
import { ChatHeader } from './chat-header'
import { ThreadPanel } from './thread-panel'
import { useMessages, useChatSocket, useConversation, type SendMessageInput, type Message } from '@/lib/api/chat'
import { PAGINATION } from '@/lib/constants/api'
import { useAgent } from '@/lib/api/agents'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useChatSocketEvents } from '@/hooks/use-chat-socket-events'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useQueryClient } from '@tanstack/react-query'

interface ChatWidgetProps {
  conversationId: string
  agentId: string
}

export function ChatWidget({ conversationId, agentId }: ChatWidgetProps) {
  const [token, setToken] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null)
  const [loadedMessageCount, setLoadedMessageCount] = useState(PAGINATION.MESSAGES_PAGE_SIZE)
  const { socket, isConnected } = useChatSocket(token)
  const { data: messagesData, isLoading, isFetching } = useMessages(conversationId, { 
    limit: loadedMessageCount,
    offset: 0,
    threadId: currentThreadId,
  })
  const { data: conversationData } = useConversation(conversationId)
  const { data: agent } = useAgent(agentId)
  const queryClient = useQueryClient()
  
  const conversation = conversationData?.conversation

  // Handle socket events
  useChatSocketEvents({
    socket,
    conversationId,
    threadId: currentThreadId,
    onTypingChange: setIsTyping,
  })

  // Reset loaded count when thread changes
  useEffect(() => {
    setLoadedMessageCount(PAGINATION.MESSAGES_PAGE_SIZE)
  }, [currentThreadId])

  // Handle thread events
  useEffect(() => {
    if (!socket) return

    const handleThreadCreated = (data: { thread: { id: string; title: string }; conversationId: string }) => {
      if (data.conversationId === conversationId) {
        queryClient.invalidateQueries({ queryKey: ['conversations', conversationId] })
      }
    }

    const handleThreadSwitched = (data: { threadId: string | null; conversationId: string }) => {
      if (data.conversationId === conversationId) {
        setCurrentThreadId(data.threadId)
        setLoadedMessageCount(PAGINATION.MESSAGES_PAGE_SIZE) // Reset pagination when switching threads
      }
    }

    const handleThreadUpdated = (data: { threadId: string; conversationId: string; message_count: number }) => {
      if (data.conversationId === conversationId) {
        queryClient.invalidateQueries({ queryKey: ['conversations', conversationId] })
      }
    }

    socket.on('thread:created', handleThreadCreated)
    socket.on('thread:switched', handleThreadSwitched)
    socket.on('thread:updated', handleThreadUpdated)

    return () => {
      socket.off('thread:created', handleThreadCreated)
      socket.off('thread:switched', handleThreadSwitched)
      socket.off('thread:updated', handleThreadUpdated)
    }
  }, [socket, conversationId, queryClient])

  // Get auth token
  useEffect(() => {
    async function getToken() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        setToken(session.access_token)
      }
    }
    getToken()
  }, [])

  // Join conversation on mount
  useEffect(() => {
    if (socket && isConnected && conversationId) {
      socket.emit('conversation:join', conversationId)
    }

    return () => {
      if (socket && conversationId) {
        socket.emit('conversation:leave', conversationId)
      }
    }
  }, [socket, isConnected, conversationId])

  const handleSendMessage = useCallback((content: string, attachments?: Array<{ url: string; type: string; name: string; size?: number }>) => {
    if (!socket || !isConnected) {
      toast.error('Not connected. Please wait...')
      return
    }

    const messageType = attachments && attachments.length > 0
      ? attachments[0].type.startsWith('image/') ? 'image' : 'file'
      : 'text'

    const messageData: SendMessageInput = {
      conversationId,
      content,
      messageType: messageType as 'text' | 'image' | 'file',
      threadId: currentThreadId || undefined,
      attachments: attachments ? JSON.parse(JSON.stringify(attachments)) : undefined,
    }

    // Optimistically add message to cache immediately
    const tempId = `temp-${Date.now()}`
    const optimisticMessage: Message = {
      _id: tempId,
      conversation_id: conversationId,
      thread_id: currentThreadId || undefined,
      sender_type: 'user',
      role: 'user',
      content,
      message_type: messageType as 'text' | 'image' | 'file',
      attachments: attachments || [],
      created_at: new Date().toISOString(),
    }

    queryClient.setQueriesData<{ messages: Message[]; total: number }>(
      {
        queryKey: ['conversations', conversationId, 'messages', currentThreadId || null],
        exact: false,
      },
      (old) => {
        if (!old) {
          return { messages: [optimisticMessage], total: 1 }
        }
        return {
          ...old,
          messages: [...old.messages, optimisticMessage],
          total: old.total + 1,
        }
      }
    )

    socket.emit('message:send', messageData)
  }, [socket, isConnected, conversationId, currentThreadId, queryClient])

  const handleTypingChange = useCallback((typing: boolean) => {
    if (!socket || !isConnected) return
    socket.emit('typing', { conversationId, isTyping: typing })
  }, [socket, isConnected, conversationId])

  // Accumulate messages from all loaded pages
  // React Query with keepPreviousData will cache each page separately
  // We need to fetch all pages up to current offset and merge them
  const allMessages = useMemo(() => {
    if (!messagesData) return []
    
    // For now, just return current page messages
    // In a more advanced implementation, we could fetch multiple pages
    return messagesData.messages || []
  }, [messagesData])
  
  // Filter messages by search query only (thread filtering is done on backend)
  const messages = useMemo(() => {
    let filtered = allMessages

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((msg) => {
        const contentMatch = msg.content.toLowerCase().includes(query)
        const attachmentMatch = msg.attachments?.some((att) => 
          att.name.toLowerCase().includes(query)
        )
        return contentMatch || attachmentMatch
      })
    }

    return filtered
  }, [allMessages, searchQuery])

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[600px]">
      {/* Threads Sidebar */}
      <div className="hidden lg:flex w-64 shrink-0 flex-col gap-4">
            <ThreadPanel
              conversationId={conversationId}
              threads={conversation?.threads}
              currentThreadId={currentThreadId}
              onThreadSelect={setCurrentThreadId}
              token={token}
            />
      </div>

      {/* Main Chat Area */}
      <Card className="flex flex-col flex-1 overflow-hidden min-w-0">
        <ChatHeader
          agent={agent}
          isConnected={isConnected}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchResultsCount={searchQuery ? messages.length : undefined}
        />

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <MessageList
            messages={messages}
            conversationId={conversationId}
            isLoading={isLoading}
            total={messagesData?.total}
            hasMore={messagesData ? loadedMessageCount < messagesData.total : false}
            onLoadMore={() => setLoadedMessageCount(prev => prev + PAGINATION.MESSAGES_PAGE_SIZE)}
            isLoadingMore={isFetching && !isLoading}
          />
          <TypingIndicator isVisible={isTyping} />
        </div>

        <Separator />

        {/* Input Area */}
        <MessageInput
          onSend={handleSendMessage}
          onTypingChange={handleTypingChange}
          disabled={!isConnected || isLoading}
          placeholder={isConnected ? 'Type your message...' : 'Connecting...'}
        />
      </Card>
    </div>
  )
}

