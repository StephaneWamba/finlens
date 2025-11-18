/**
 * Redis connection utility
 * Used by Chat Service and Agent Service
 */

import Redis from 'ioredis'

let redisClient: Redis | null = null
let lastErrorLogTime = 0
const ERROR_LOG_INTERVAL = 60000 // Only log errors once per minute

export function createRedisClient(uri: string): Redis {
  if (redisClient) {
    return redisClient
  }

  redisClient = new Redis(uri, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000)
      // Stop retrying after 10 attempts (about 5 seconds)
      if (times > 10) {
        return null // Stop retrying
      }
      return delay
    },
    // Add connection timeout
    connectTimeout: 5000,
    lazyConnect: false, // Try to connect immediately
  })

  redisClient.on('connect', () => {
    console.log('✅ Redis connected successfully')
    lastErrorLogTime = 0 // Reset error log timer on successful connection
  })

  redisClient.on('error', (error: Error) => {
    // Only log errors once per minute to prevent spam
    const now = Date.now()
    if (now - lastErrorLogTime > ERROR_LOG_INTERVAL) {
      // Suppress connection timeout errors - they're expected if Redis isn't running
      if (error.message.includes('ETIMEDOUT') || error.message.includes('ECONNREFUSED')) {
        // Silently handle - Redis is optional
      } else {
        console.error('❌ Redis connection error:', error.message)
      }
      lastErrorLogTime = now
    }
  })

  return redisClient
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call createRedisClient first.')
  }
  return redisClient
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
    console.log('✅ Redis disconnected')
  }
}

