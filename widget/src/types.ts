/**
 * Type definitions for Syntera Widget
 */

export interface WidgetConfig {
  agentId: string
  apiKey: string
  apiUrl: string
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  theme?: 'light' | 'dark'
}

export interface Agent {
  id: string
  name: string
  avatar_url?: string
  model?: string
  system_prompt?: string
}

export interface Conversation {
  id: string
  agent_id: string
  channel: 'chat' | 'voice' | 'video'
  status: 'active' | 'ended' | 'archived'
  started_at: string
  threads?: Thread[]
}

export interface Thread {
  id: string
  title: string
  created_at: string
  message_count?: number
}

export interface Message {
  id: string
  conversation_id: string
  thread_id?: string | null
  role: 'user' | 'agent' | 'system'
  content: string
  created_at: string
  attachments?: Attachment[]
}

export interface Attachment {
  id: string
  type: 'image' | 'file'
  url: string
  name: string
  size?: number
}

export interface CreateConversationInput {
  agentId: string
  channel: 'chat' | 'voice' | 'video'
  contactId?: string
}

export interface SendMessageInput {
  conversationId: string
  content: string
  threadId?: string | null
  attachments?: File[]
}

export interface LiveKitTokenResponse {
  token: string
  url: string
  roomName: string
}

export interface WebSocketConfig {
  url: string
  token: string
}

export interface CallConfig {
  type: 'voice' | 'video'
  token: string
  url: string
  conversationId: string
  agentId: string
  apiUrl: string
  apiKey: string
}

