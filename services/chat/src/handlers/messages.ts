/**
 * Message Handlers
 * Handles real-time message sending and receiving
 */

import { Server } from 'socket.io'
import { AuthenticatedSocket } from '../middleware/auth.js'
import { Conversation, Message } from '@syntera/shared/models'
import { createLogger } from '@syntera/shared/logger/index.js'
import { generateAgentResponse } from './agent.js'
import { invalidateMessagesCache } from '../utils/cache.js'
import { z } from 'zod'

const logger = createLogger('chat-service:messages')

// Message validation schema
const SendMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1).max(10000),
  messageType: z.enum(['text', 'audio', 'video', 'file', 'image']).default('text'),
  threadId: z.string().optional(),
  attachments: z.array(z.object({
    url: z.string(),
    type: z.string(),
    name: z.string(),
    size: z.number().optional(),
  })).optional().transform((val) => {
    // Ensure it's always an array or undefined
    if (!val) return undefined
    if (Array.isArray(val)) return val
    return []
  }),
})

/**
 * Handle sending a message
 */
export async function handleSendMessage(
  io: Server,
  socket: AuthenticatedSocket,
  data: unknown
) {
  try {
    interface ProcessedData {
      attachments?: unknown
      conversationId?: string
      content?: string
      messageType?: string
      [key: string]: unknown
    }
    
    const processedData = data as ProcessedData
    
    if (processedData?.attachments) {
      if (typeof processedData.attachments === 'string') {
        try {
          const parsed = JSON.parse(processedData.attachments)
          processedData.attachments = Array.isArray(parsed) ? parsed : []
        } catch {
          processedData.attachments = []
        }
      } else if (!Array.isArray(processedData.attachments)) {
        processedData.attachments = []
      }
    }
    const validationResult = SendMessageSchema.safeParse(processedData)
    if (!validationResult.success) {
      logger.warn('Message validation failed', {
        errors: validationResult.error.issues,
        receivedData: {
          hasConversationId: !!processedData?.conversationId,
          hasContent: !!processedData?.content,
          contentLength: processedData?.content?.length,
          messageType: processedData?.messageType,
          hasAttachments: !!processedData?.attachments,
        }
      })
      socket.emit('error', { 
        message: 'Invalid message data',
        details: validationResult.error.issues[0].message 
      })
      return
    }

    const { conversationId, content, messageType, threadId, attachments } = validationResult.data

    if (!socket.userId || !socket.companyId) {
      logger.warn('Unauthenticated message attempt', {
        socketId: socket.id,
        hasUserId: !!socket.userId,
        hasCompanyId: !!socket.companyId,
      })
      socket.emit('error', { message: 'User not authenticated' })
      return
    }

    // Verify conversation exists and belongs to user's company
    const conversation = await Conversation.findOne({
      _id: conversationId,
      company_id: socket.companyId,
    })

    if (!conversation) {
      logger.warn('Conversation not found', {
        conversationId,
        companyId: socket.companyId,
        userId: socket.userId,
      })
      socket.emit('error', { message: 'Conversation not found' })
      return
    }

    let safeAttachments: Array<{ url: string; type: string; name: string; size?: number }> = []
    
    if (attachments) {
      if (Array.isArray(attachments)) {
        safeAttachments = attachments
          .filter((att) => att && typeof att === 'object' && att.url && att.type && att.name)
          .map((att) => ({
          url: String(att.url),
          type: String(att.type),
          name: String(att.name),
          size: typeof att.size === 'number' ? att.size : undefined,
        }))
      } else if (typeof attachments === 'string') {
        try {
          const parsed = JSON.parse(attachments)
          if (Array.isArray(parsed)) {
            safeAttachments = parsed.filter((att) => att && att.url && att.type && att.name)
          }
        } catch {
          safeAttachments = []
        }
      }
    }

    let detectedIntent: { category: string; confidence: number; reasoning?: string } | undefined
    let detectedSentiment: { 
      sentiment: string
      score: number
      confidence: number
      emotions?: string[]
      reasoning?: string
    } | undefined
    
    if (socket.token && messageType === 'text') {
      try {
        const agentServiceUrl = process.env.AGENT_SERVICE_URL || 'http://localhost:4002'
        
        const intentResponse = await fetch(`${agentServiceUrl}/api/responses/detect-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${socket.token}`,
          },
          body: JSON.stringify({ message: content }),
        })

        if (intentResponse.ok) {
          detectedIntent = await intentResponse.json() as { category: string; confidence: number; reasoning?: string }
        }

        const sentimentResponse = await fetch(`${agentServiceUrl}/api/responses/sentiment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${socket.token}`,
          },
          body: JSON.stringify({ message: content }),
        })

        if (sentimentResponse.ok) {
          detectedSentiment = await sentimentResponse.json() as { 
            sentiment: string
            score: number
            confidence: number
            emotions?: string[]
            reasoning?: string
          }
        }
      } catch (error) {
        logger.warn('Failed to detect intent or sentiment', { error })
      }
    }
    
    const message = await Message.create({
      conversation_id: conversationId,
      thread_id: threadId,
      sender_type: 'user',
      role: 'user',
      content,
      message_type: messageType,
      attachments: safeAttachments,
      metadata: {
        ...(detectedIntent ? {
          intent: {
            category: detectedIntent.category,
            confidence: detectedIntent.confidence,
            reasoning: detectedIntent.reasoning,
          },
        } : {}),
        ...(detectedSentiment ? {
          sentiment: {
            sentiment: detectedSentiment.sentiment,
            score: detectedSentiment.score,
            confidence: detectedSentiment.confidence,
            emotions: detectedSentiment.emotions,
            reasoning: detectedSentiment.reasoning,
          },
        } : {}),
      },
    })

    if (threadId) {
      try {
        const updatedConversation = await Conversation.findOne({
          _id: conversationId,
          company_id: socket.companyId,
        })
        if (updatedConversation?.threads) {
          const thread = updatedConversation.threads.find(t => String(t.id) === String(threadId))
        if (thread) {
          thread.message_count = (thread.message_count || 0) + 1
            updatedConversation.markModified('threads')
            await updatedConversation.save()
          io.to(`conversation:${conversationId}`).emit('thread:updated', {
            threadId,
            conversationId,
            message_count: thread.message_count,
          })
        }
      }
      } catch (error) {
        logger.error('Error updating thread message count', {
          error: error instanceof Error ? error.message : String(error),
          threadId,
          conversationId,
        })
      }
    }

    await invalidateMessagesCache(conversationId, threadId)

    io.to(`conversation:${conversationId}`).emit('message', {
      _id: String(message._id),
      conversation_id: conversationId,
      thread_id: threadId,
      sender_type: 'user',
      role: 'user',
      content,
      message_type: messageType,
      attachments: attachments || [],
      metadata: message.metadata || {},
      created_at: message.created_at.toISOString(),
    })

    if (conversation.agent_id && socket.token) {
      generateAgentResponse(
        io,
        conversationId,
        content,
        conversation.agent_id,
        socket.companyId!,
        socket.token,
        safeAttachments.length > 0 ? safeAttachments : undefined,
        threadId
      ).catch((error) => {
        logger.error('Failed to generate agent response', { 
          error: error instanceof Error ? error.message : String(error),
          conversationId,
        })
        io.to(`conversation:${conversationId}`).emit('error', {
          message: 'Failed to generate AI response',
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      })
    }
  } catch (error) {
    logger.error('Error sending message', {
      socketId: socket.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    
    socket.emit('error', { 
      message: 'Failed to send message',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Handle typing indicator
 */
export function handleTyping(
  io: Server,
  socket: AuthenticatedSocket,
  data: { conversationId: string; isTyping: boolean }
) {
  try {
    if (!data.conversationId) {
      return
    }

    socket.to(`conversation:${data.conversationId}`).emit('typing', {
      userId: socket.userId,
      conversationId: data.conversationId,
      isTyping: data.isTyping,
    })
  } catch (error) {
    logger.error('Error handling typing indicator', { error, socketId: socket.id })
  }
}

