/**
 * API Constants
 * Centralized API endpoints, limits, and configuration
 */

// API Endpoints
export const API_ENDPOINTS = {
  AGENTS: '/api/agents',
  CONVERSATIONS: '/api/conversations',
  MESSAGES: '/api/conversations',
  KNOWLEDGE_BASE: '/api/knowledge-base',
  CHAT_UPLOAD: '/api/chat/upload',
} as const

// Service URLs
export const SERVICE_URLS = {
  AGENT: process.env.NEXT_PUBLIC_AGENT_SERVICE_URL || 'http://localhost:4002',
  CHAT: process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || 'http://localhost:4004',
  KNOWLEDGE_BASE: process.env.NEXT_PUBLIC_KNOWLEDGE_BASE_SERVICE_URL || 'http://localhost:4005',
} as const

// Pagination & Limits
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MESSAGES_LIMIT: 50, // Reduced from 100 for better initial load performance
  MESSAGES_PAGE_SIZE: 20, // Messages to load per page
  CONVERSATIONS_PAGE_SIZE: 10, // Conversations to load per page
  DOCUMENTS_LIMIT: 50,
  AGENTS_LIMIT: 50,
  MAX_LIMIT: 1000,
} as const

// Timeouts (in milliseconds)
export const TIMEOUTS = {
  API_REQUEST: 30000, // 30 seconds
  FILE_UPLOAD: 300000, // 5 minutes
  SOCKET_CONNECTION: 10000, // 10 seconds
} as const

// Cache TTL (in milliseconds)
export const CACHE_TTL = {
  SHORT: 5000, // 5 seconds
  MEDIUM: 30000, // 30 seconds
  LONG: 60000, // 1 minute
  VERY_LONG: 300000, // 5 minutes
} as const

