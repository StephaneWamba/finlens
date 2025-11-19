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
import sentimentRouter from './routes/sentiment.js'
import livekitRouter from './routes/livekit.js'
import voiceBotRouter from './routes/voice-bot.js'
import callRecordingsRouter from './routes/call-recordings.js'
import publicRouter from './routes/public.js'

const logger = createLogger('agent-service')
const app = express()
const PORT = process.env.PORT || 4002

// Trust proxy (required for Cloudflare Tunnel, load balancers, etc.)
// This allows Express to correctly identify client IPs from X-Forwarded-For headers
app.set('trust proxy', true)


// Middleware
app.use(helmet())
app.use(compression()) // Enable gzip compression
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, or file:// protocol)
    if (!origin) {
      return callback(null, true)
    }
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:8000',
      'http://localhost:8080',
      'null', // For file:// protocol
    ]
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true)
    } else {
      callback(null, true) // Allow all for development - restrict in production
    }
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

// Rate limiting
// Note: trust proxy is enabled for Cloudflare Tunnel compatibility
// The rate limiter will use X-Forwarded-For header to identify client IPs
// Using custom keyGenerator to work properly with proxy headers
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Custom key generator that works with proxies
  // When behind Cloudflare Tunnel, req.ip will use X-Forwarded-For header
  // This is safe because Cloudflare sets this header and we trust the proxy
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown'
  },
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
app.use('/api/responses', sentimentRouter) // Sentiment analysis endpoint
app.use('/api/livekit', livekitRouter)
app.use('/api/voice-bot', voiceBotRouter)
app.use('/api/call-recordings', callRecordingsRouter)

// Log all requests to /api/public
app.use('/api/public', (req, res, next) => {
  logger.info('Public API request received', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
  })
  next()
})
app.use('/api/public', publicRouter) // Public API for widget

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

