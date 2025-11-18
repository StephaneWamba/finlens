/**
 * Conversation Handlers
 * Handles conversation creation and joining
 */

import { Server } from 'socket.io'
import { AuthenticatedSocket } from '../middleware/auth.js'
import { Conversation } from '@syntera/shared/models'
import { createLogger } from '@syntera/shared/logger/index.js'
import { z } from 'zod'

const logger = createLogger('chat-service:conversations')

// Create conversation schema
const CreateConversationSchema = z.object({
  agentId: z.string().min(1),
  channel: z.enum(['chat', 'voice', 'video', 'email', 'sms']).default('chat'),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Handle creating a new conversation
 */
export async function handleCreateConversation(
  io: Server,
  socket: AuthenticatedSocket,
  data: unknown
) {
  try {
    // Validate input
    const validationResult = CreateConversationSchema.safeParse(data)
    if (!validationResult.success) {
      socket.emit('error', { 
        message: 'Invalid conversation data',
        details: validationResult.error.issues[0].message 
      })
      return
    }

    const { agentId, channel, metadata } = validationResult.data

    if (!socket.userId || !socket.companyId) {
      socket.emit('error', { message: 'User not authenticated' })
      return
    }

    // Create conversation
    const conversation = await Conversation.create({
      agent_id: agentId,
      company_id: socket.companyId,
      user_id: socket.userId,
      channel,
      status: 'active',
      metadata: metadata || {},
    })

    // Join conversation room
    socket.join(`conversation:${String(conversation._id)}`)

    // Emit conversation created
    socket.emit('conversation:created', {
      id: String(conversation._id),
      agentId,
      channel,
      status: conversation.status,
      startedAt: conversation.started_at,
    })

    logger.info('Conversation created', { 
      conversationId: String(conversation._id),
      agentId,
      userId: socket.userId,
      companyId: socket.companyId 
    })
  } catch (error) {
    logger.error('Error creating conversation', { error, socketId: socket.id })
    socket.emit('error', { message: 'Failed to create conversation' })
  }
}

/**
 * Handle joining an existing conversation
 */
export async function handleJoinConversation(
  io: Server,
  socket: AuthenticatedSocket,
  conversationId: string
) {
  try {
    if (!socket.userId || !socket.companyId) {
      socket.emit('error', { message: 'User not authenticated' })
      return
    }

    // Verify conversation exists and belongs to user's company
    const conversation = await Conversation.findOne({
      _id: conversationId,
      company_id: socket.companyId,
    })

    if (!conversation) {
      socket.emit('error', { message: 'Conversation not found' })
      return
    }

    // Join conversation room
    socket.join(`conversation:${conversationId}`)

    // Emit conversation joined
    socket.emit('conversation:joined', {
      id: String(conversation._id),
      agentId: conversation.agent_id,
      channel: conversation.channel,
      status: conversation.status,
      startedAt: conversation.started_at,
    })

    logger.info('User joined conversation', { 
      conversationId,
      userId: socket.userId 
    })
  } catch (error) {
    logger.error('Error joining conversation', { error, socketId: socket.id })
    socket.emit('error', { message: 'Failed to join conversation' })
  }
}

/**
 * Handle leaving a conversation
 */
export function handleLeaveConversation(
  socket: AuthenticatedSocket,
  conversationId: string
) {
  try {
    socket.leave(`conversation:${conversationId}`)
    logger.info('User left conversation', { 
      conversationId,
      userId: socket.userId 
    })
  } catch (error) {
    logger.error('Error leaving conversation', { error, socketId: socket.id })
  }
}


