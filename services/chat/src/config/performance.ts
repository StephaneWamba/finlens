/**
 * Performance Configuration
 * Optimized settings for Docker environments
 */

export const PERFORMANCE_CONFIG = {
  // MongoDB connection pool (adjust based on container memory)
  MONGODB_POOL_SIZE: parseInt(process.env.MONGODB_POOL_SIZE || '10', 10),
  MONGODB_MAX_POOL_SIZE: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '50', 10),
  
  // Redis cache TTLs
  CACHE_TTL: {
    CONVERSATION: 60, // 60 seconds
    MESSAGES: 30, // 30 seconds
    AGENT_CONFIG: 300, // 5 minutes
  },
  
  // Query limits
  MAX_MESSAGES_PER_REQUEST: 100,
  MAX_CONVERSATIONS_PER_REQUEST: 50,
  
  // Node.js heap size (adjust based on container memory limit)
  // For 512MB container: use ~384MB heap
  // For 1GB container: use ~768MB heap
  NODE_HEAP_SIZE: process.env.NODE_OPTIONS?.includes('--max-old-space-size')
    ? undefined // Already set via NODE_OPTIONS
    : process.env.CONTAINER_MEMORY_LIMIT === '512m' ? '384' : '768',
} as const

