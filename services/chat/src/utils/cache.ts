/**
 * Redis Cache Utilities
 * Provides caching for frequently accessed data
 */

import { redis } from '../config/database.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('chat-service:cache')
const CACHE_TTL = 60 // 60 seconds default TTL
const MESSAGES_CACHE_TTL = 120 // 2 minutes for messages (longer TTL for better performance)

/**
 * Get cached value
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis || redis.status !== 'ready') {
    return null
  }

  try {
    const value = await redis.get(key)
    if (value) {
      return JSON.parse(value) as T
    }
    return null
  } catch (error) {
    logger.warn('Cache get error', { key, error })
    return null
  }
}

/**
 * Set cached value
 */
export async function setCache(key: string, value: unknown, ttlSeconds = CACHE_TTL): Promise<void> {
  if (!redis || redis.status !== 'ready') {
    return
  }

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value))
  } catch (error) {
    logger.warn('Cache set error', { key, error })
  }
}

/**
 * Delete cached value
 */
export async function deleteCache(key: string): Promise<void> {
  if (!redis || redis.status !== 'ready') {
    return
  }

  try {
    await redis.del(key)
  } catch (error) {
    logger.warn('Cache delete error', { key, error })
  }
}

/**
 * Generate cache key for conversation
 */
export function getConversationCacheKey(conversationId: string): string {
  return `conversation:${conversationId}`
}

/**
 * Generate cache key for conversation messages
 * Includes thread_id for granular caching
 */
export function getMessagesCacheKey(
  conversationId: string, 
  limit?: number, 
  offset?: number,
  threadId?: string | null
): string {
  const parts = [
    'messages',
    conversationId,
    threadId || 'null',
    limit || 100,
    offset || 0,
  ]
  return parts.join(':')
}

/**
 * Invalidate all message caches for a conversation
 * Used when messages are created/updated
 */
export async function invalidateConversationCache(conversationId: string): Promise<void> {
  if (!redis || redis.status !== 'ready') {
    return
  }

  try {
    // Delete all message cache keys for this conversation
    const pattern = `messages:${conversationId}:*`
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (error) {
    logger.warn('Cache invalidation error', { conversationId, error })
  }
}

/**
 * Invalidate cache for specific thread
 */
export async function invalidateMessagesCache(
  conversationId: string,
  threadId?: string | null
): Promise<void> {
  if (!redis || redis.status !== 'ready') {
    return
  }

  try {
    // Delete cache keys matching the thread pattern
    const pattern = `messages:${conversationId}:${threadId || 'null'}:*`
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (error) {
    logger.warn('Cache invalidation error', { conversationId, threadId, error })
  }
}
