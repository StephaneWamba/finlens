/**
 * Agent Integration Handler
 * Handles AI agent responses to user messages
 */

import { Server } from 'socket.io'
import { AuthenticatedSocket } from '../middleware/auth.js'
import { Message, Conversation } from '@syntera/shared/models'
import { createLogger } from '@syntera/shared/logger/index.js'
import { invalidateConversationCache } from '../utils/cache.js'
// Constants for summarization
const SUMMARY_THRESHOLD = 30 // Summarize when conversation has 30+ messages
const SUMMARY_INTERVAL = 20 // Update summary every 20 new messages

/**
 * Check if conversation should be summarized
 */
function shouldSummarizeConversation(messageCount: number, lastSummaryCount?: number): boolean {
  if (messageCount >= SUMMARY_THRESHOLD) {
    if (!lastSummaryCount) {
      return true // First summary
    }
    return messageCount - lastSummaryCount >= SUMMARY_INTERVAL
  }
  return false
}

/**
 * Optimize conversation history using summary
 */
function optimizeConversationHistory(
  allMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  summary?: string,
  summaryMessageCount?: number
): {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  summary: string | undefined
} {
  if (summary && summaryMessageCount && allMessages.length > SUMMARY_THRESHOLD) {
    const recentMessages = allMessages.slice(-10)
    return {
      messages: recentMessages,
      summary,
    }
  }
  return {
    messages: allMessages.slice(-20),
    summary: undefined,
  }
}

/**
 * Format conversation history with summary for OpenAI
 */
function formatConversationWithSummary(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  summary?: string
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  const formatted: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []

  if (summary) {
    formatted.push({
      role: 'system',
      content: `Previous conversation summary: ${summary}\n\nContinue the conversation based on this context.`,
    })
  }

  for (const msg of messages) {
    formatted.push({
      role: msg.role,
      content: msg.content,
    })
  }

  return formatted
}

const logger = createLogger('chat-service:agent')

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:4002'

/**
 * Generate AI agent response to a user message
 */
export async function generateAgentResponse(
  io: Server,
  conversationId: string,
  userMessage: string,
  agentId: string,
  companyId: string,
  userToken: string,
  attachments?: Array<{ url: string; type: string; name: string; size?: number }>
) {
  try {
    // Get conversation to check for summary
    const conversation = await Conversation.findById(conversationId).lean()
    
    // Get all messages for summarization check
    const allMessages = await Message.find({
      conversation_id: conversationId,
    })
      .select('content role attachments created_at')
      .sort({ created_at: 1 }) // Sort chronologically for summarization
      .lean()

    const messageCount = allMessages.length

    // Check if we should summarize
    let shouldSummarize = false
    if (conversation && shouldSummarizeConversation(messageCount, conversation.summary_message_count)) {
      shouldSummarize = true
      logger.info('Conversation needs summarization', { conversationId, messageCount })
    }

    // Generate summary if needed
    if (shouldSummarize && conversation) {
      try {
        // Format messages for summarization (exclude system messages)
        const messagesForSummary = allMessages
          .filter((msg) => msg.role !== 'system')
          .map((msg) => {
            let content = msg.content
            if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
              const attachmentInfo = msg.attachments.map((att: any) => 
                `[Attachment: ${att.name}]`
              ).join(', ')
              content = `${content} (${attachmentInfo})`
            }
            return {
              role: msg.role as 'user' | 'assistant',
              content,
            }
          })

        // Generate summary using Agent Service
        const summaryResponse = await fetch(`${AGENT_SERVICE_URL}/api/responses/summarize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            messages: messagesForSummary,
          }),
        })

        if (summaryResponse.ok) {
          const { summary } = await summaryResponse.json() as { summary: string }
          
          // Update conversation with summary
          await Conversation.findByIdAndUpdate(conversationId, {
            summary,
            summary_updated_at: new Date(),
            summary_message_count: messageCount,
          })

          logger.info('Conversation summary updated', { conversationId, messageCount })
        }
      } catch (summaryError) {
        logger.warn('Failed to generate conversation summary', { error: summaryError })
        // Continue without summary
      }
    }

    // Get updated conversation with summary
    const updatedConversation = await Conversation.findById(conversationId).lean()

    // Optimize conversation history (use summary if available)
    const recentMessages = allMessages.slice(-30) // Get last 30 for optimization
    const optimized = optimizeConversationHistory(
      recentMessages.map((msg) => {
        let content = msg.content
        if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
          const attachmentInfo = msg.attachments.map((att: any) => 
            `[Attachment: ${att.name} (${att.type}) - ${att.url}]`
          ).join('\n')
          content = `${content}\n\nAttachments:\n${attachmentInfo}`
        }
        return {
          role: msg.role as 'user' | 'assistant' | 'system',
          content,
        }
      }),
      updatedConversation?.summary,
      updatedConversation?.summary_message_count
    )

    // Format conversation history for OpenAI
    const conversationHistory = formatConversationWithSummary(
      optimized.messages,
      optimized.summary
    )

    // Call Agent Service to generate response
    const response = await fetch(`${AGENT_SERVICE_URL}/api/responses/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        agentId,
        message: attachments && attachments.length > 0
          ? `${userMessage}\n\n[User has attached ${attachments.length} file(s): ${attachments.map(a => a.name).join(', ')}]`
          : userMessage,
        conversationHistory,
        includeKnowledgeBase: true,
        attachments: attachments,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to generate response' })) as { error?: string }
      throw new Error(errorData.error || 'Failed to generate agent response')
    }

    const result = await response.json() as {
      response: string
      metadata: {
        agentId: string
        model: string
        tokensUsed: number
        knowledgeBaseUsed: boolean
      }
    }

    // Create agent message in database
    const agentMessage = await Message.create({
      conversation_id: conversationId,
      sender_type: 'agent',
      role: 'assistant',
      content: result.response,
      message_type: 'text',
      ai_metadata: {
        model: result.metadata.model,
        tokens_used: result.metadata.tokensUsed,
        response_time_ms: Date.now(),
      },
    })

    // Invalidate cache for this conversation's messages
    await invalidateConversationCache(conversationId)

    // Emit message to conversation room
    io.to(`conversation:${conversationId}`).emit('message', {
      id: String(agentMessage._id),
      conversationId,
      senderType: 'agent',
      role: 'assistant',
      content: result.response,
      messageType: 'text',
      aiMetadata: result.metadata,
      createdAt: agentMessage.created_at,
    })

    logger.info('Agent response completed', {
      conversationId,
      agentId,
      model: result.metadata.model,
      tokensUsed: result.metadata.tokensUsed,
    })
  } catch (error) {
    logger.error('Error generating agent response', { error, conversationId, agentId })
    
    // Send error message to user
    const errorMessage = await Message.create({
      conversation_id: conversationId,
      sender_type: 'system',
      role: 'system',
      content: 'Sorry, I encountered an error. Please try again.',
      message_type: 'system',
    })

    io.to(`conversation:${conversationId}`).emit('message', {
      id: String(errorMessage._id),
      conversationId,
      senderType: 'system',
      role: 'system',
      content: errorMessage.content,
      messageType: 'system',
      createdAt: errorMessage.created_at,
    })

    throw error
  }
}
