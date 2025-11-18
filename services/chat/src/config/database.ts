/**
 * Chat Service - Database Configuration
 */

import { connectMongoDB } from '@syntera/shared/database/mongodb.js'
import { createRedisClient } from '@syntera/shared/database/redis.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('chat-service')

// Redis client for caching and pub/sub
export const redis = createRedisClient(process.env.REDIS_URL!)

// Initialize connections
export async function initializeDatabase() {
  try {
    // Connect to MongoDB (optional for local development)
    if (process.env.MONGODB_URI) {
      try {
        await connectMongoDB(process.env.MONGODB_URI)
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
          logger.warn('   Service will continue without MongoDB (some features may not work)')
        } else {
          // Re-throw other errors
          throw error
        }
      }
    } else {
      logger.warn('⚠️  MONGODB_URI not set - running without MongoDB')
    }

    // Redis connection status (check with delay to allow connection to establish)
    setTimeout(() => {
      if (redis && redis.status === 'ready') {
        logger.info('✅ Redis connected')
      } else if (redis && redis.status === 'connecting') {
        logger.debug('Redis connecting... (will log when ready)')
      } else {
        // Don't warn - Redis is optional and may connect later
        logger.debug('Redis not connected yet (optional - will retry automatically)')
      }
    }, 1000)
  } catch (error) {
    logger.error('Database initialization failed', { error })
    // Don't throw - allow service to start even if databases are unavailable
    // This is useful for local development
  }
}

