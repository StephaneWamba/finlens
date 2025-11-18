/**
 * Redis Configuration
 * Connects to Redis for BullMQ job queue
 */

import Redis from 'ioredis'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('knowledge-base-service:redis')

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    const isLocalhost = redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1')
    
    logger.info(`Connecting to Redis: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`)
    
    const isTLS = redisUrl.startsWith('rediss://') || (process.env.REDIS_TLS === 'true' && !isLocalhost)
    
    // Parse URL to extract host and port for family option
    const urlObj = new URL(redisUrl)
    const host = urlObj.hostname
    const port = parseInt(urlObj.port || '6379', 10)
    
    redis = new Redis({
      host,
      port,
      family: 4, // Force IPv4 to avoid IPv6 issues
      maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
      tls: isTLS ? {
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
      } : undefined,
      connectTimeout: 10000,
      enableReadyCheck: false, // Disable ready check - we'll verify with PING
      enableOfflineQueue: true,
      lazyConnect: true, // Connect explicitly after setup
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        if (times > 10) {
          return null
        }
        return delay
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY'
        if (err.message.includes(targetError)) {
          return true
        }
        return false
      },
    })

    redis.on('connect', () => {
      logger.info('Redis connecting...')
    })

    redis.on('ready', () => {
      logger.info('Redis ready')
    })

    redis.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message })
    })

    redis.on('close', () => {
      logger.warn('Redis connection closed')
    })

    // Connect explicitly after event listeners are set up
    redis.connect().catch((err) => {
      logger.error('Failed to connect to Redis', { error: err.message })
    })
  }

  return redis
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
    logger.info('Redis connection closed')
  }
}

