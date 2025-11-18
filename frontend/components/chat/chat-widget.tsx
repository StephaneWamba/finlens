'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { MessageList } from './message-list'
import { MessageInput } from './message-input'
import { TypingIndicator } from './typing-indicator'
import { ChatHeader } from './chat-header'
import { useMessages, useChatSocket, type SendMessageInput } from '@/lib/api/chat'
import { PAGINATION } from '@/lib/constants/api'
import { useAgent } from '@/lib/api/agents'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useChatSocketEvents } from '@/hooks/use-chat-socket-events'

interface ChatWidgetProps {
  conversationId: string
  agentId: string
}

export function ChatWidget({ conversationId, agentId }: ChatWidgetProps) {
  const [token, setToken] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { socket, isConnected } = useChatSocket(token)
  const { data: messagesData, isLoading } = useMessages(conversationId, { limit: PAGINATION.MESSAGES_LIMIT })
  const { data: agent } = useAgent(agentId)

  // Handle socket events
  useChatSocketEvents({
    socket,
    conversationId,
    onTypingChange: setIsTyping,
  })

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
      attachments: attachments ? JSON.parse(JSON.stringify(attachments)) : undefined, // Ensure clean serialization
    }

    socket.emit('message:send', messageData)
  }, [socket, isConnected, conversationId])

  const handleTypingChange = useCallback((typing: boolean) => {
    if (!socket || !isConnected) return
    socket.emit('typing', { conversationId, isTyping: typing })
  }, [socket, isConnected, conversationId])

  // Get messages from query data, with fallback to empty array
  const allMessages = messagesData?.messages || []
  
  // Filter messages by search query
  const messages = useMemo(() => {
    if (!searchQuery.trim()) return allMessages
    
    const query = searchQuery.toLowerCase()
    return allMessages.filter((msg) => {
      const contentMatch = msg.content.toLowerCase().includes(query)
      const attachmentMatch = msg.attachments?.some((att) => 
        att.name.toLowerCase().includes(query)
      )
      return contentMatch || attachmentMatch
    })
  }, [allMessages, searchQuery])

  return (
    <Card className="flex flex-col h-[600px] overflow-hidden">
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
  )
}

