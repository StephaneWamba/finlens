/**
 * Database Configuration
 * Connects to Supabase (PostgreSQL) and Pinecone
 */

import { createClient } from '@supabase/supabase-js'
import { Pinecone } from '@pinecone-database/pinecone'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('knowledge-base-service:database')

// Supabase client (will be initialized in initializeDatabase)
let supabase: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (!supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    }
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  }
  return supabase
}

// Pinecone client
let pinecone: Pinecone | null = null

export async function initializePinecone() {
  try {
    if (!process.env.PINECONE_API_KEY) {
      logger.warn('PINECONE_API_KEY not set - Pinecone features will be disabled')
      return null
    }

    logger.info('Initializing Pinecone client...')

    const isServerless = process.env.PINECONE_API_KEY.startsWith('pcsk_')
    const pineconeConfig: any = {
      apiKey: process.env.PINECONE_API_KEY,
    }
    
    if (!isServerless) {
      const environment = process.env.PINECONE_ENVIRONMENT || 'us-east-1-aws'
      pineconeConfig.environment = environment
    }

    pinecone = new Pinecone(pineconeConfig)

    const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'syntera-knowledge-base'
    const index = pinecone.Index(INDEX_NAME)
    await index.describeIndexStats()
    logger.info(`Pinecone client initialized and connected to index: ${INDEX_NAME}`)

    return pinecone
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to initialize Pinecone', { error: errorMessage })
    logger.warn('Pinecone features will be disabled - document processing will work but vectors won\'t be stored')
    pinecone = null
    return null
  }
}

export function getPinecone() {
  return pinecone
}

export async function initializeDatabase() {
  try {
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    }

    // Initialize Supabase client
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Verify Supabase connection
    const { data, error } = await supabase.from('knowledge_base_documents').select('id').limit(1)
    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`)
    }
    logger.info('Supabase connected')

    // Initialize Pinecone (optional)
    await initializePinecone()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    logger.error('Database initialization failed', { 
      error: errorMessage,
      stack: errorStack 
    })
    throw error
  }
}

