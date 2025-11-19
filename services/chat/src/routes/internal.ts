/**
 * Internal API Routes for Service-to-Service Communication
 * These endpoints are used by other services (Agent Service, etc.)
 */

import express from 'express'
import { Server } from 'socket.io'
import { z } from 'zod'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('chat-service:internal')
const router = express.Router()

// Simple token validation for internal service calls
function validateInternalToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN || 'internal-token'
  
  if (token !== expectedToken) {
    logger.warn('Invalid internal service token', { provided: token?.substring(0, 10) + '...' })
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  next()
}

const EmitMessageSchema = z.object({
  conversationId: z.string().min(1),
  message: z.object({
    _id: z.string(),
    conversation_id: z.string(),
    thread_id: z.string().nullable().optional(),
    sender_type: z.enum(['user', 'agent', 'system']),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    message_type: z.string(),
    ai_metadata: z.record(z.string(), z.any()).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    created_at: z.string(),
  }),
})

/**
 * POST /api/internal/messages/emit
 * Emit a message via Socket.io to connected clients
 * Used by Agent Service to send agent responses to widgets
 */
router.post(
  '/messages/emit',
  validateInternalToken,
  (req: express.Request, res: express.Response) => {
    try {
      const validationResult = EmitMessageSchema.safeParse(req.body)
      if (!validationResult.success) {
        logger.warn('Validation failed for emit message', { 
          issues: validationResult.error.issues,
        })
        return res.status(400).json({ 
          error: 'Validation failed',
          details: validationResult.error.issues 
        })
      }

      const { conversationId, message } = validationResult.data

      // Get Socket.io instance from app
      const io: Server | undefined = req.app.get('io')
      
      if (!io) {
        logger.error('Socket.io instance not found in app', { 
          availableKeys: Object.keys(req.app.locals || {}),
        })
        return res.status(500).json({ error: 'Socket.io not initialized' })
      }

      // Emit message to all clients in the conversation room
      io.to(`conversation:${conversationId}`).emit('message', message)

      logger.info('Message emitted via internal API', {
        conversationId,
        messageId: message._id,
        senderType: message.sender_type,
      })

      res.json({ success: true, messageId: message._id })
    } catch (error) {
      logger.error('Failed to emit message', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        conversationId: req.body?.conversationId,
      })
      res.status(500).json({ error: 'Failed to emit message' })
    }
  }
)

export default router

