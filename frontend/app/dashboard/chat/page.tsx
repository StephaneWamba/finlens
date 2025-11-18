'use client'

import { useState, useEffect } from 'react'
import { useAgents } from '@/lib/api/agents'
import { useConversations, useChatSocket, type CreateConversationInput } from '@/lib/api/chat'
import { ChatWidget } from '@/components/chat/chat-widget'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LoadingSkeleton } from '@/components/shared/loading-skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { MessageSquare, Plus, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

export default function ChatPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [token, setToken] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { data: agents, isLoading: agentsLoading } = useAgents()
  const { data: conversationsData, isLoading: conversationsLoading } = useConversations({ status: 'active' })
  const { socket } = useChatSocket(token)

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

  const handleCreateConversation = async () => {
    if (!selectedAgentId) {
      toast.error('Please select an agent')
      return
    }

    if (!socket) {
      toast.error('Not connected. Please wait...')
      return
    }

    const conversationData: CreateConversationInput = {
      agentId: selectedAgentId,
      channel: 'chat',
    }

    socket.emit('conversation:create', conversationData)

    // Listen for conversation created
    const handleConversationCreated = (data: { id: string; agentId: string }) => {
      setSelectedConversationId(data.id)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      socket.off('conversation:created', handleConversationCreated)
    }

    socket.on('conversation:created', handleConversationCreated)
  }

  if (agentsLoading || conversationsLoading) {
    return <LoadingSkeleton />
  }

  const conversations = conversationsData?.conversations || []
  const activeConversation = conversations.find(c => c._id === selectedConversationId)

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Chat</h1>
          <p className="text-muted-foreground text-lg mt-1">
            Chat with your AI agents
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar - Conversations & Agent Selection */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-4"
        >
          <Card>
            <CardHeader>
              <CardTitle>Start New Chat</CardTitle>
              <CardDescription>Select an agent to begin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleCreateConversation} className="w-full" disabled={!selectedAgentId || !socket}>
                <Plus className="mr-2 h-4 w-4" />
                Start Chat
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Conversations</CardTitle>
              {conversations.length > 0 && (
                <CardDescription>{conversations.length} active</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No active conversations"
                  description="Start a new chat to begin"
                />
              ) : (
                <div className="space-y-1.5">
                  {conversations.map((conversation) => {
                    const agent = agents?.find(a => a.id === conversation.agent_id)
                    const isSelected = selectedConversationId === conversation._id
                    return (
                      <Button
                        key={conversation._id}
                        variant={isSelected ? 'default' : 'ghost'}
                        className={cn(
                          'w-full justify-start h-auto py-3 px-3',
                          isSelected && 'bg-primary text-primary-foreground shadow-sm'
                        )}
                        onClick={() => {
                          setSelectedConversationId(conversation._id)
                          setSelectedAgentId(conversation.agent_id)
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <MessageSquare className="h-4 w-4 shrink-0" />
                          <div className="flex-1 min-w-0 text-left">
                            <p className="font-medium text-sm truncate">
                              {agent?.name || 'Agent Chat'}
                            </p>
                            {agent?.model && (
                              <p className="text-xs opacity-70 truncate">{agent.model}</p>
                            )}
                          </div>
                        </div>
                      </Button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Main Chat Area */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-2"
        >
          {selectedConversationId && activeConversation ? (
            <ChatWidget
              conversationId={selectedConversationId}
              agentId={activeConversation.agent_id}
            />
          ) : (
            <Card className="h-[600px] flex items-center justify-center">
              <div className="text-center space-y-4">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">No conversation selected</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select an agent and start a new chat, or choose an existing conversation
                  </p>
                </div>
              </div>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  )
}

