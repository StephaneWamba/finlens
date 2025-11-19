/**
 * Agent Service - Database Configuration
 */

import { createClient } from '@supabase/supabase-js'
import { createRedisClient } from '@syntera/shared/database/redis.js'
import { connectMongoDB } from '@syntera/shared/database/mongodb.js'
import { createLogger } from '@syntera/shared/logger/index.js'

type Redis = Awaited<ReturnType<typeof createRedisClient>>

const logger = createLogger('agent-service')

// Supabase client for PostgreSQL
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Redis client for caching (optional - will be null if Redis is unavailable)
let redis: Redis | null = null

// Initialize Redis connection (non-blocking, graceful failure)
if (process.env.REDIS_URL) {
  try {
    redis = createRedisClient(process.env.REDIS_URL)
    
    // Set up error handler to prevent spam
    redis.on('error', (error: Error) => {
      // Only log warnings, not errors, to prevent spam
      if (redis?.status !== 'ready') {
        // Silently handle - Redis is optional
      }
    })
    
    redis.on('connect', () => {
      logger.info('✅ Redis connected')
    })
    
    // Check connection status after a short delay to allow connection to establish
    setTimeout(() => {
      if (redis && redis.status === 'ready') {
        logger.info('✅ Redis connection verified')
      } else if (redis && redis.status === 'connecting') {
        // Still connecting, will log when ready
      } else {
        // Connection failed or not available - this is OK for local dev
        logger.debug('Redis not connected (optional - service will continue without caching)')
      }
    }, 2000)
  } catch (error) {
    logger.warn('Failed to initialize Redis - continuing without cache', { error })
  }
} else {
  logger.warn('REDIS_URL not set - running without Redis cache')
}

// Helper to get Redis client (returns null if unavailable)
export function getRedis(): Redis | null {
  try {
    return redis && redis.status === 'ready' ? redis : null
  } catch {
    return null
  }
}

// Initialize connections
export async function initializeDatabase() {
  try {
    // Verify Supabase connection
    const { error: supabaseError } = await supabase.from('agent_configs').select('id').limit(1)
    if (supabaseError) {
      logger.error('Supabase connection failed', { error: supabaseError })
      throw supabaseError
    }
    logger.info('✅ Supabase connected')

    // Connect to MongoDB (required for conversation storage)
    // Default to Docker MongoDB if MONGODB_URI is not set
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/syntera'
    
    if (!process.env.MONGODB_URI) {
      logger.info('ℹ️  MONGODB_URI not set, using default Docker MongoDB: mongodb://localhost:27017/syntera')
    }
    
    try {
      await connectMongoDB(mongoUri)
      logger.info('✅ MongoDB connected')
    } catch (error: any) {
      // Check if it's a network/timeout error (likely VPC/private network issue)
      if (error?.message?.includes('ETIMEDOUT') || 
          error?.message?.includes('ECONNREFUSED') ||
          error?.message?.includes('ENOTFOUND')) {
        logger.warn('⚠️  MongoDB connection failed - likely not accessible from local machine')
        logger.warn('   AWS DocumentDB is in a private VPC and requires VPN/bastion host')
        logger.warn('   For local development, use:')
        logger.warn('   1. Local MongoDB: mongodb://localhost:27017/syntera')
        logger.warn('   2. MongoDB Atlas (cloud): mongodb+srv://...')
        logger.warn('   3. Docker: docker run -d -p 27017:27017 mongo')
        logger.warn('   Service will continue without MongoDB (conversation creation will fail)')
      } else {
        // Re-throw other errors
        throw error
      }
    }

    // Redis connection status (check with delay to allow connection to establish)
    setTimeout(() => {
      if (redis && redis.status === 'ready') {
        logger.info('✅ Redis connected')
      } else {
        // Don't warn - Redis is optional and may connect later
        logger.debug('Redis not connected yet (optional - will retry automatically)')
      }
    }, 1000)
  } catch (error) {
    logger.error('Database initialization failed', { error })
    throw error
  }
}




