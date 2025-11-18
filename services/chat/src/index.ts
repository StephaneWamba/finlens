/**
 * Chat Service
 * Port: 4004
 * Handles real-time chat via Socket.io and conversation storage in MongoDB
 */

import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { initializeDatabase } from './config/database.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { authenticateSocket, type AuthenticatedSocket } from './middleware/auth.js'
import { handleSendMessage, handleTyping } from './handlers/messages.js'
import { handleCreateConversation, handleJoinConversation, handleLeaveConversation } from './handlers/conversations.js'
import { handleCreateThread, handleSwitchThread } from './handlers/threads.js'
import conversationsRouter from './routes/conversations.js'

const logger = createLogger('chat-service')
const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
})
const PORT = process.env.PORT || 4004

// Middleware
app.use(helmet())
app.use(compression()) // Enable gzip compression for better performance
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}))
app.use(express.json({ limit: '10mb' })) // Limit request body size

// Rate limiting - increased limits for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per window (increased from 100)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests', message: 'Please try again later' })
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health'
  },
})
app.use('/api/', limiter)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'chat-service', timestamp: new Date().toISOString() })
})

// REST API routes
app.use('/api/conversations', conversationsRouter)

// Socket.io authentication middleware
io.use(authenticateSocket)

// Socket.io connection handling
io.on('connection', (socket: AuthenticatedSocket) => {
  logger.info('Client connected', { 
    socketId: socket.id,
    userId: socket.userId,
    companyId: socket.companyId 
  })

  // Conversation events
  socket.on('conversation:create', (data) => {
    handleCreateConversation(io, socket, data)
  })

  socket.on('conversation:join', (conversationId: string) => {
    handleJoinConversation(io, socket, conversationId)
  })

  socket.on('conversation:leave', (conversationId: string) => {
    handleLeaveConversation(socket, conversationId)
  })

  // Message events
  socket.on('message:send', (data) => {
    handleSendMessage(io, socket, data)
  })

  socket.on('typing', (data) => {
    handleTyping(io, socket, data)
  })

  // Thread events
  socket.on('thread:create', (data) => {
    handleCreateThread(io, socket, data)
  })

  socket.on('thread:switch', (data) => {
    handleSwitchThread(io, socket, data)
  })

  socket.on('disconnect', () => {
    logger.info('Client disconnected', { 
      socketId: socket.id,
      userId: socket.userId 
    })
  })
})

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack })
  res.status(500).json({ error: 'Internal server error' })
})

// Start server
async function start() {
  try {
    // Start server first
    httpServer.listen(PORT, () => {
      logger.info(`🚀 Chat Service running on port ${PORT}`)
    })
    
    // Initialize database connections (non-blocking)
    initializeDatabase().catch((error) => {
      logger.warn('Database initialization failed, but service is running', { error: error.message })
    })
  } catch (error) {
    logger.error('Failed to start service', { error })
    process.exit(1)
  }
}

start()







