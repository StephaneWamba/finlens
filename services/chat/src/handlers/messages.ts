/**
 * Message Handlers
 * Handles real-time message sending and receiving
 */

import { Server } from 'socket.io'
import { AuthenticatedSocket } from '../middleware/auth.js'
import { Conversation, Message } from '@syntera/shared/models'
import { createLogger } from '@syntera/shared/logger/index.js'
import { generateAgentResponse } from './agent.js'
import { invalidateConversationCache } from '../utils/cache.js'
import { z } from 'zod'

const logger = createLogger('chat-service:messages')

// Message validation schema
const SendMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1).max(10000),
  messageType: z.enum(['text', 'audio', 'video', 'file', 'image']).default('text'),
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
    // Preprocess data - handle case where Socket.io might serialize arrays as strings
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
          // Try to parse as JSON - handle both JSON and malformed strings
          let parsed
          try {
            parsed = JSON.parse(processedData.attachments)
          } catch (jsonError) {
            // If JSON.parse fails, try to extract array from the string representation
            // Handle cases like "[\\n' + '  {\\n' + \"    url: '...'..."
            logger.warn('JSON.parse failed, attempting to extract array from string', {
              preview: processedData.attachments.substring(0, 200)
            })
            // Try to find and extract a valid JSON array from the string
            const arrayMatch = processedData.attachments.match(/\[[\s\S]*\]/)
            if (arrayMatch) {
              try {
                parsed = JSON.parse(arrayMatch[0])
              } catch (e2) {
                throw new Error('Could not extract valid JSON from string')
              }
            } else {
              throw new Error('No array pattern found in string')
            }
          }
          
          if (Array.isArray(parsed)) {
            processedData.attachments = parsed
          } else {
            logger.warn('Parsed attachments is not an array', { parsed })
            processedData.attachments = []
          }
        } catch (e) {
          // If all parsing fails, log and set to empty array
          const attachmentsStr = typeof processedData.attachments === 'string' ? processedData.attachments : ''
          logger.error('Failed to parse attachments string', { 
            error: e instanceof Error ? e.message : 'Unknown error',
            preview: attachmentsStr.substring(0, 200)
          })
          processedData.attachments = []
        }
      } else if (!Array.isArray(processedData.attachments)) {
        // If it's not an array and not a string, set to empty array
        logger.warn('Attachments is neither string nor array', { 
          type: typeof processedData.attachments,
          value: processedData.attachments
        })
        processedData.attachments = []
      }
    }
    
    // Validate input
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

    const { conversationId, content, messageType, attachments } = validationResult.data

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

    // Ensure attachments is a proper array before creating message
    let safeAttachments: Array<{ url: string; type: string; name: string; size?: number }> = []
    
    if (attachments) {
      if (Array.isArray(attachments)) {
        safeAttachments = attachments.filter((att) => {
          return att && typeof att === 'object' && att.url && att.type && att.name
        }).map((att) => ({
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
        } catch (e) {
          logger.error('Failed to parse attachments string', { error: e })
        }
      }
    }

    // Detect intent from user message (async, non-blocking)
    let detectedIntent: { category: string; confidence: number; reasoning?: string } | undefined
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
          logger.debug('Intent detected for message', { 
            intent: detectedIntent.category, 
            confidence: detectedIntent.confidence 
          })
        }
      } catch (intentError) {
        logger.warn('Failed to detect intent', { error: intentError })
        // Continue without intent - not critical
      }
    }
    
    const message = await Message.create({
      conversation_id: conversationId,
      sender_type: 'user',
      role: 'user',
      content,
      message_type: messageType,
      attachments: safeAttachments,
      metadata: detectedIntent ? {
        intent: {
          category: detectedIntent.category,
          confidence: detectedIntent.confidence,
          reasoning: detectedIntent.reasoning,
        },
      } : undefined,
    })

    // Invalidate cache for this conversation's messages
    await invalidateConversationCache(conversationId)

    // Broadcast message to all clients in the conversation room
    io.to(`conversation:${conversationId}`).emit('message', {
      id: String(message._id),
      conversationId,
      senderType: 'user',
      role: 'user',
      content,
      messageType,
      attachments: attachments || [],
      createdAt: message.created_at,
    })

    logger.info('Message sent', { 
      messageId: String(message._id),
      conversationId,
      userId: socket.userId 
    })

    // Generate AI agent response (async, don't wait)
    if (conversation.agent_id && socket.token) {
      generateAgentResponse(
        io,
        conversationId,
        content,
        conversation.agent_id,
        socket.companyId!,
        socket.token,
        safeAttachments.length > 0 ? safeAttachments : undefined // Pass attachments to agent
      ).catch((error) => {
        logger.error('Failed to generate agent response', { 
          error: error instanceof Error ? error.message : String(error),
          conversationId,
          hasAttachments: safeAttachments.length > 0
        })
        // Emit error to client
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

    // Broadcast typing indicator to other users in the conversation
    socket.to(`conversation:${data.conversationId}`).emit('typing', {
      userId: socket.userId,
      conversationId: data.conversationId,
      isTyping: data.isTyping,
    })
  } catch (error) {
    logger.error('Error handling typing indicator', { error, socketId: socket.id })
  }
}

