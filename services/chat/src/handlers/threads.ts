/**
 * Thread Handlers
 * Handles conversation thread management
 */

import { Server } from 'socket.io'
import { AuthenticatedSocket } from '../middleware/auth.js'
import { Conversation, Message } from '@syntera/shared/models'
import { createLogger } from '@syntera/shared/logger/index.js'
import { invalidateConversationCache } from '../utils/cache.js'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const logger = createLogger('chat-service:threads')

// Thread validation schemas
const CreateThreadSchema = z.object({
  conversationId: z.string().min(1),
  title: z.string().min(1).max(200),
})

const SwitchThreadSchema = z.object({
  conversationId: z.string().min(1),
  threadId: z.string().min(1).nullable(),
})

/**
 * Create a new thread in a conversation
 */
export async function handleCreateThread(
  io: Server,
  socket: AuthenticatedSocket,
  data: unknown
) {
  try {
    const validationResult = CreateThreadSchema.safeParse(data)
    if (!validationResult.success) {
      socket.emit('error', { message: 'Invalid thread data', details: validationResult.error.issues[0].message })
      return
    }

    const { conversationId, title } = validationResult.data

    // Verify conversation exists and user has access
    const conversation = await Conversation.findOne({
      _id: conversationId,
      company_id: socket.companyId,
    })

    if (!conversation) {
      socket.emit('error', { message: 'Conversation not found' })
      return
    }

    // Create new thread
    const threadId = randomUUID()
    const newThread = {
      id: threadId,
      title,
      created_at: new Date(),
      message_count: 0,
    }

    // Add thread to conversation
    const threads = conversation.threads || []
    threads.push(newThread)

    await Conversation.findByIdAndUpdate(conversationId, {
      threads,
    })

    // Invalidate cache
    await invalidateConversationCache(conversationId)

    // Emit thread created event
    io.to(`conversation:${conversationId}`).emit('thread:created', {
      thread: newThread,
      conversationId,
    })

    logger.info('Thread created', { threadId, conversationId, title })
  } catch (error) {
    logger.error('Failed to create thread', { error })
    socket.emit('error', { message: 'Failed to create thread' })
  }
}

/**
 * Switch to a thread (set active thread for messages)
 */
export async function handleSwitchThread(
  io: Server,
  socket: AuthenticatedSocket,
  data: unknown
) {
  try {
    const validationResult = SwitchThreadSchema.safeParse(data)
    if (!validationResult.success) {
      socket.emit('error', { message: 'Invalid thread data', details: validationResult.error.issues[0].message })
      return
    }

    const { conversationId, threadId } = validationResult.data

    // Verify conversation exists
    const conversation = await Conversation.findOne({
      _id: conversationId,
      company_id: socket.companyId,
    })

    if (!conversation) {
      socket.emit('error', { message: 'Conversation not found' })
      return
    }

    // If threadId is null, switch to main thread (messages without thread_id)
    // Otherwise, verify thread exists
    if (threadId !== null && threadId !== undefined) {
      const threads = conversation.threads || []
      const thread = threads.find(t => t.id === threadId)

      if (!thread) {
        socket.emit('error', { message: 'Thread not found' })
        return
      }
    }

    // Emit thread switched event (messages will be refetched by frontend)
    socket.emit('thread:switched', {
      threadId: threadId ?? null,
      conversationId,
    })

    logger.info('Thread switched', { threadId, conversationId })
  } catch (error) {
    logger.error('Failed to switch thread', { error })
    socket.emit('error', { message: 'Failed to switch thread' })
  }
}

