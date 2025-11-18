/**
 * Agent Service
 * Port: 4002
 * Handles AI agent orchestration, LiveKit integration, and OpenAI interactions
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { initializeDatabase } from './config/database.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { initializeOpenAI } from './services/openai.js'
import agentsRouter from './routes/agents.js'
import responsesRouter from './routes/responses.js'
import summarizeRouter from './routes/summarize.js'
import intentRouter from './routes/intent.js'

const logger = createLogger('agent-service')
const app = express()
const PORT = process.env.PORT || 4002

// Middleware
app.use(helmet())
app.use(compression()) // Enable gzip compression
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
})
app.use('/api/', limiter)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'agent-service', timestamp: new Date().toISOString() })
})

// API routes
app.use('/api/agents', agentsRouter)
app.use('/api/responses', responsesRouter)
app.use('/api/responses', summarizeRouter) // Summarize endpoint
app.use('/api/responses', intentRouter) // Intent detection endpoint

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack })
  res.status(500).json({ error: 'Internal server error' })
})

// Start server
async function start() {
  try {
    // Start server first
    app.listen(PORT, () => {
      logger.info(`🚀 Agent Service running on port ${PORT}`)
    })
    
    // Initialize database connections and OpenAI (non-blocking)
    Promise.all([
      initializeDatabase(),
      initializeOpenAI(),
    ]).catch((error) => {
      logger.warn('Initialization failed, but service is running', { error: error.message })
    })
  } catch (error) {
    logger.error('Failed to start service', { error })
    process.exit(1)
  }
}

start()

