/**
 * Type Definitions Index
 * Central export for all type definitions
 */

// Re-export API types
export type { Conversation, Message, SendMessageInput } from '@/lib/api/chat'
export type { Agent, CreateAgentInput, UpdateAgentInput } from '@/lib/api/agents'
export type { KnowledgeBaseDocument } from '@/lib/api/knowledge-base'

// Re-export schema types
export type { AgentFormValues } from '@/lib/schemas/agent'

// Common types
export interface PaginationParams {
  limit?: number
  offset?: number
  page?: number
}

export interface ApiResponse<T> {
  data: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

