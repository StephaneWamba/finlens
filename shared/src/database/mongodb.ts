/**
 * MongoDB connection utility
 * Used by Chat Service
 */

import mongoose, { ConnectOptions } from 'mongoose'
import { existsSync } from 'fs'
import { join } from 'path'

/**
 * Process MongoDB URI to handle missing certificate files gracefully
 */
function processMongoDBUri(uri: string): string {
  // Check if URI contains tlsCAFile parameter
  if (!uri.includes('tlsCAFile=')) {
    return uri
  }

  // Extract the certificate file path from the URI
  const tlsCAFileMatch = uri.match(/tlsCAFile=([^&]+)/)
  if (!tlsCAFileMatch) {
    return uri
  }

  const certFileName = tlsCAFileMatch[1]
  
  // Check multiple possible locations for the certificate
  const certPaths = [
    certFileName, // Relative path as specified in URI
    join(process.cwd(), certFileName), // Project root
    join(process.cwd(), 'services', 'chat', certFileName), // Chat service directory
  ]

  // Check if certificate exists in any location
  const certExists = certPaths.some(path => existsSync(path))
  
  if (!certExists) {
    console.warn(`⚠️  MongoDB certificate (${certFileName}) not found`)
    console.warn('   Attempting connection without certificate (for local development)')
    console.warn('   ⚠️  This is NOT secure for production!')
    console.warn('   Download certificate from AWS DocumentDB if connecting to production')
    
    // Remove tlsCAFile parameter from URI
    uri = uri.replace(/[?&]tlsCAFile=[^&]+/, (match) => {
      // If this is the first parameter (after ?), keep the ?
      // Otherwise remove the & as well
      return match.startsWith('?') ? '?' : ''
    })
    
    // Clean up any double ? or trailing &
    uri = uri.replace(/\?&/, '?').replace(/[?&]$/, '')
  }

  return uri
}

export async function connectMongoDB(uri: string): Promise<void> {
  try {
    // Process URI to handle missing certificates
    const processedUri = processMongoDBUri(uri)
    
    // Connection pool configuration optimized for Docker
    // Default pool size: 10, max: 50 (adjust based on container resources)
    const poolSize = parseInt(process.env.MONGODB_POOL_SIZE || '10', 10)
    const maxPoolSize = parseInt(process.env.MONGODB_MAX_POOL_SIZE || '50', 10)
    
    await mongoose.connect(processedUri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      // Connection pool settings
      maxPoolSize,
      minPoolSize: Math.min(poolSize, 5), // Minimum pool size
      maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    } as ConnectOptions)
    
    // Disable mongoose buffering (set after connection)
    mongoose.set('bufferCommands', false)
    console.log('✅ MongoDB connected successfully')
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    throw error
  }
}

export async function disconnectMongoDB(): Promise<void> {
  try {
    await mongoose.disconnect()
    console.log('✅ MongoDB disconnected')
  } catch (error) {
    console.error('❌ MongoDB disconnection error:', error)
    throw error
  }
}

