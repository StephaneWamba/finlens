/**
 * Avatar Service
 * Port: 4009
 * Handles AI avatar video generation and streaming to LiveKit
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { createLogger } from '@syntera/shared/logger/index.js'
import { AvatarService } from './services/avatar.js'
import { providerRegistry } from './providers/index.js'
import { z } from 'zod'

const logger = createLogger('avatar-service')
const app = express()
const PORT = process.env.PORT || 4009

const avatarService = new AvatarService()

// Middleware
app.use(helmet())
app.use(compression())
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true)
    }
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:4002',
      'http://localhost:4004',
    ]
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true)
    } else {
      callback(null, true) // Allow all for development
    }
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' },
})
app.use('/api/', limiter)

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'avatar-service',
    timestamp: new Date().toISOString(),
    availableProviders: providerRegistry.getAvailable(),
  })
})

// WebSocket endpoint for avatar streaming
app.get('/ws/avatar/:conversationId', async (req, res) => {
  const { conversationId } = req.params

  // Upgrade to WebSocket connection
  // This would be handled by a WebSocket library like 'ws'
  // For now, return stream URL info
  res.json({
    conversationId,
    streamUrl: `ws://localhost:${PORT}/ws/avatar/${conversationId}`,
    message: 'WebSocket endpoint - connect via WebSocket client',
  })
})

// Start avatar stream
const StartStreamSchema = z.object({
  conversationId: z.string(),
  agentId: z.string(),
  companyId: z.string(),
  roomName: z.string(),
  liveKitUrl: z.string(),
  liveKitToken: z.string(),
  avatarImageUrl: z.string().optional(),
  provider: z.enum(['did', 'custom']).optional(),
})

app.post('/api/avatar/start', async (req, res) => {
  try {
    const validationResult = StartStreamSchema.safeParse(req.body)
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.issues,
      })
    }

    const config = validationResult.data

    logger.info('Avatar stream start requested', {
      conversationId: config.conversationId,
      provider: config.provider || 'did',
    })

    // Start avatar stream asynchronously
    // The LiveKit service will connect to the room and capture audio
    // Then stream to D-ID and publish video back
    avatarService.startAvatarStream(
      new (await import('stream')).PassThrough(), // Placeholder audio stream - will be replaced by LiveKit audio
      {
        conversationId: config.conversationId,
        agentId: config.agentId,
        companyId: config.companyId,
        avatarImageUrl: config.avatarImageUrl,
        provider: config.provider,
        liveKitUrl: config.liveKitUrl,
        liveKitToken: config.liveKitToken,
        roomName: config.roomName,
      }
    ).catch((error) => {
      logger.error('Failed to start avatar stream in background', { error })
    })

    res.json({
      success: true,
      conversationId: config.conversationId,
      message: 'Avatar stream started',
    })
  } catch (error) {
    logger.error('Failed to start avatar stream', { error })
    res.status(500).json({ error: 'Failed to start avatar stream' })
  }
})

// Stop avatar stream
app.post('/api/avatar/stop/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params
    await avatarService.stopAvatarStream(conversationId)
    res.json({ success: true, conversationId })
  } catch (error) {
    logger.error('Failed to stop avatar stream', { error })
    res.status(500).json({ error: 'Failed to stop avatar stream' })
  }
})

// Get active streams
app.get('/api/avatar/streams', (req, res) => {
  res.json({
    activeStreams: avatarService.getActiveStreams(),
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
    // Initialize available providers
    const providerType = (process.env.AVATAR_PROVIDER || 'did') as 'did' | 'custom'
    logger.info(`Initializing avatar provider: ${providerType}`)

    app.listen(PORT, () => {
      logger.info(`🚀 Avatar Service running on port ${PORT}`)
      logger.info(`Available providers: ${providerRegistry.getAvailable().join(', ')}`)
    })
  } catch (error) {
    logger.error('Failed to start service', { error })
    process.exit(1)
  }
}

start()

