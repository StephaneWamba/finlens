/**
 * Knowledge Base Service
 * Port: 4005
 * Handles document processing, text extraction, chunking, and vector embeddings
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { createLogger } from '@syntera/shared/logger/index.js'
import { initializeDatabase } from './config/database.js'
import { initializeProcessor } from './services/processor.js'
import { enqueueDocument, closeQueue, getDocumentWorker } from './services/queue.js'
import { getSupabase } from './config/database.js'
import documentRoutes from './routes/documents.js'

const logger = createLogger('knowledge-base-service')
const app = express()
const PORT = process.env.PORT || 4005

// Middleware
app.use(helmet())
app.use(compression()) // Enable gzip compression
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  })
)
app.use(express.json({ limit: '50mb' })) // Larger limit for document uploads

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
})
app.use('/api/', limiter)

// API routes
app.use('/api/documents', documentRoutes)

// Health check
app.get('/health', async (req, res) => {
  try {
    const { getQueueStats } = await import('./services/queue.js')
    const queueStats = await getQueueStats()
    res.json({
      status: 'ok',
      service: 'knowledge-base-service',
      queue: queueStats,
    })
  } catch (error) {
    res.json({
      status: 'ok',
      service: 'knowledge-base-service',
      queue: { error: 'Unable to fetch queue stats' },
    })
  }
})

// Error handling
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack })
    res.status(500).json({ error: 'Internal server error' })
  }
)

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...')
  await closeQueue()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...')
  await closeQueue()
  process.exit(0)
})

// Start server
async function start() {
  try {
    logger.info('Initializing database connections...')
    try {
      await initializeDatabase()
      logger.info('Database initialization complete')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Database initialization failed', { 
        error: errorMessage 
      })
    }

    app.listen(PORT, () => {
      logger.info(`Knowledge Base Service running on port ${PORT}`)
    })

    initializeProcessor()
    logger.info('Checking for pending documents to enqueue...')
    try {
      const supabase = getSupabase()
      const { data: pendingDocuments, error } = await supabase
        .from('knowledge_base_documents')
        .select('id')
        .eq('status', 'pending')
        .limit(100) // Enqueue up to 100 pending documents

      if (error) {
        logger.error('Failed to fetch pending documents', { error })
      } else if (pendingDocuments && pendingDocuments.length > 0) {
        logger.info(`Enqueueing ${pendingDocuments.length} pending documents`)
        // Enqueue documents in parallel with timeout protection
        const enqueuePromises = pendingDocuments.map(async (doc) => {
          const docWithId = doc as { id: string } | null
          if (docWithId?.id) {
            try {
              await Promise.race([
                enqueueDocument(docWithId.id),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error('Enqueue timeout')), 5000)
                )
              ])
            } catch (error) {
              logger.warn(`Failed to enqueue document ${docWithId.id}, will use fallback`)
            }
          }
        })
        
        Promise.all(enqueuePromises).catch(() => {
          logger.warn('Some documents failed to enqueue, will be processed via fallback')
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to enqueue pending documents', { error: errorMessage })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to start service', { error: errorMessage })
    process.exit(1)
  }
}

start()







