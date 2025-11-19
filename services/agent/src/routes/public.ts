/**
 * Public API Routes for Widget
 * These endpoints are used by the embeddable widget
 * Authentication via API key (not user JWT)
 */

import express from 'express'
import { z } from 'zod'
import { authenticateApiKey, ApiKeyRequest } from '../middleware/api-key-auth.js'
import { supabase } from '../config/database.js'
import { generateAccessToken, getRoomName, getLiveKitUrl, getUserPermissions } from '../services/livekit.js'
import { handleError, badRequest } from '../utils/errors.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { Conversation, Message } from '@syntera/shared/models'
import { generateResponse } from '../services/openai.js'

const logger = createLogger('agent-service:public-api')
const router = express.Router()

// Enable CORS for all public routes (widget can be embedded anywhere)
router.use((req, res, next) => {
  // Allow all origins including null (for file:// protocol in development)
  const origin = req.headers.origin
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin)
  } else {
    // Allow null origin for file:// protocol
    res.header('Access-Control-Allow-Origin', '*')
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Credentials', 'true')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

/**
 * GET /api/public/test
 * Test endpoint to verify Supabase connection
 */
router.get('/test', async (req, res) => {
  logger.info('Test endpoint called')
  try {
    const { data, error } = await supabase
      .from('agent_configs')
      .select('id, name, company_id')
      .limit(1)
    
    if (error) {
      return res.status(500).json({ 
        error: 'Supabase query failed',
        message: error.message,
        code: error.code,
        details: error
      })
    }
    
    res.json({ 
      success: true,
      message: 'Supabase connection working',
      agentCount: data?.length || 0,
      sampleAgent: data?.[0] || null
    })
  } catch (error) {
    res.status(500).json({ 
      error: 'Test failed',
      message: error instanceof Error ? error.message : String(error)
    })
  }
})

// Request schemas
const GetAgentSchema = z.object({
  agentId: z.string().uuid(),
})

const CreateConversationSchema = z.object({
  agentId: z.string().uuid(),
  channel: z.enum(['chat', 'voice', 'video']).default('chat'),
  contactId: z.string().uuid().optional(),
})

const SendMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1).max(10000),
  threadId: z.string().optional().nullable(),
})

const LiveKitTokenSchema = z.object({
  conversationId: z.string().min(1),
  agentId: z.string().uuid(),
})

const WebSocketConfigSchema = z.object({
  conversationId: z.string().min(1),
})

/**
 * GET /api/public/agents/:agentId
 * Get agent configuration (public info only)
 */
router.get(
  '/agents/:agentId',
  authenticateApiKey,
  async (req: ApiKeyRequest, res) => {
    try {
      const { agentId } = req.params

      if (agentId !== req.agentId) {
        return res.status(403).json({ error: 'Agent ID mismatch' })
      }

      const { data: agent, error } = await supabase
        .from('agent_configs')
        .select('id, name, model, system_prompt, temperature')
        .eq('id', agentId)
        .single()

      if (error || !agent) {
        logger.warn('Agent not found', { agentId, companyId: req.companyId })
        return res.status(404).json({ error: 'Agent not found' })
      }

      res.json({
        id: agent.id,
        name: agent.name,
        model: agent.model,
      })
    } catch (error) {
      logger.error('Failed to get agent', { error })
      handleError(error, res)
    }
  }
)

/**
 * POST /api/public/conversations
 * Create a new conversation (anonymous user)
 */
router.post(
  '/conversations',
  authenticateApiKey,
  async (req: ApiKeyRequest, res) => {
    try {
      const validationResult = CreateConversationSchema.safeParse(req.body)
      if (!validationResult.success) {
        return badRequest(res, validationResult.error.issues[0].message)
      }

      const { agentId, channel, contactId } = validationResult.data

      if (agentId !== req.agentId) {
        return res.status(403).json({ error: 'Agent ID mismatch' })
      }

      // Verify agent exists (already verified in middleware, but double-check)
      const { data: agent, error: agentError } = await supabase
        .from('agent_configs')
        .select('id, company_id')
        .eq('id', agentId)
        .eq('company_id', req.companyId!)
        .single()

      if (agentError || !agent) {
        return res.status(404).json({ error: 'Agent not found' })
      }

      // Create conversation in MongoDB
      const conversation = await Conversation.create({
        agent_id: agentId,
        company_id: req.companyId!,
        channel,
        status: 'active',
        metadata: {
          source: 'widget',
          contact_id: contactId,
        },
      })

      logger.info('Conversation created via public API', {
        conversationId: String(conversation._id),
        agentId,
        companyId: req.companyId,
      })

      res.json({
        conversation: {
          id: String(conversation._id),
          agent_id: conversation.agent_id,
          channel: conversation.channel,
          status: conversation.status,
          started_at: conversation.started_at.toISOString(),
        },
      })
    } catch (error) {
      logger.error('Failed to create conversation', { error })
      handleError(error, res)
    }
  }
)

/**
 * POST /api/public/messages
 * Send a message (creates message and triggers agent response)
 */
router.post(
  '/messages',
  authenticateApiKey,
  async (req: ApiKeyRequest, res) => {
    try {
      const validationResult = SendMessageSchema.safeParse(req.body)
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Validation failed',
          details: validationResult.error.issues 
        })
      }

      const { conversationId, content, threadId } = validationResult.data

      // Verify conversation exists
      // For routes without agentId in middleware, we need to verify conversation exists first
      const conversation = await Conversation.findOne({
        _id: conversationId,
      })

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      // If companyId wasn't set by middleware (route without agentId), set it from conversation
      if (!req.companyId) {
        req.companyId = conversation.company_id
        req.agentId = conversation.agent_id
      } else {
        // Verify conversation belongs to company
        if (conversation.company_id !== req.companyId) {
          return res.status(403).json({ error: 'Conversation does not belong to company' })
        }
        
        // Verify agent matches
        if (conversation.agent_id !== req.agentId) {
          return res.status(403).json({ error: 'Agent mismatch' })
        }
      }

      // Create message
      const message = await Message.create({
        conversation_id: conversationId,
        thread_id: threadId || null,
        sender_type: 'user',
        role: 'user',
        content,
        message_type: 'text',
      })

      logger.info('Message created via public API', {
        messageId: String(message._id),
        conversationId,
      })

      // Trigger agent response (async, don't wait)
      generateAgentResponseForWidget(
        conversationId,
        content,
        conversation.agent_id,
        req.companyId!,
        threadId || null
      ).catch((error) => {
        logger.error('Failed to generate agent response', { error, conversationId })
      })

      res.json({
        message: {
          id: String(message._id),
          conversation_id: conversationId,
          thread_id: threadId || null,
          role: 'user',
          content,
          created_at: message.created_at.toISOString(),
        },
      })
    } catch (error) {
      logger.error('Failed to send message', { error })
      handleError(error, res)
    }
  }
)

/**
 * POST /api/public/livekit/token
 * Generate LiveKit token for voice/video calls
 */
router.post(
  '/livekit/token',
  authenticateApiKey,
  async (req: ApiKeyRequest, res) => {
    try {
      const validationResult = LiveKitTokenSchema.safeParse(req.body)
      if (!validationResult.success) {
        return badRequest(res, validationResult.error.issues[0].message)
      }

      const { conversationId, agentId } = validationResult.data

      if (agentId !== req.agentId) {
        return res.status(403).json({ error: 'Agent ID mismatch' })
      }

      // Verify conversation exists
      const conversation = await Conversation.findOne({
        _id: conversationId,
        company_id: req.companyId!,
      })

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      const roomName = getRoomName(conversationId)
      const identity = `widget-user:${conversationId}` // Anonymous user identity
      const permissions = getUserPermissions()

      const token = await generateAccessToken({
        identity,
        roomName,
        permissions,
        metadata: JSON.stringify({
          agentId,
          conversationId,
          companyId: req.companyId!,
          source: 'widget',
        }),
      })

      logger.info('LiveKit token generated via public API', {
        conversationId,
        agentId,
        roomName,
      })

      res.json({
        token,
        url: getLiveKitUrl(),
        roomName,
        identity,
      })
    } catch (error) {
      logger.error('Failed to generate LiveKit token', { error })
      handleError(error, res)
    }
  }
)

/**
 * POST /api/public/websocket/config
 * Get WebSocket configuration for chat service
 */
router.post(
  '/websocket/config',
  authenticateApiKey,
  async (req: ApiKeyRequest, res) => {
    try {
      const validationResult = WebSocketConfigSchema.safeParse(req.body)
      if (!validationResult.success) {
        return badRequest(res, validationResult.error.issues[0].message)
      }

      const { conversationId } = validationResult.data

      // Verify conversation exists
      const conversation = await Conversation.findOne({
        _id: conversationId,
      })

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      // If companyId wasn't set by middleware (route without agentId), set it from conversation
      if (!req.companyId) {
        req.companyId = conversation.company_id
        req.agentId = conversation.agent_id
      } else {
        // Verify conversation belongs to company
        if (conversation.company_id !== req.companyId) {
          return res.status(403).json({ error: 'Conversation does not belong to company' })
        }
      }

      // For widget, we'll use a simple token-based approach
      // The chat service will need to accept API key tokens
      // For MVP, return the chat service URL and a token
      const chatServiceUrl = process.env.CHAT_SERVICE_URL || 'http://localhost:4004'
      
      // Generate a simple token (in production, use proper JWT)
      const token = Buffer.from(JSON.stringify({
        conversationId,
        agentId: req.agentId,
        companyId: req.companyId,
        apiKey: req.apiKey,
      })).toString('base64')

      res.json({
        url: chatServiceUrl.replace('http://', 'ws://').replace('https://', 'wss://'),
        token,
      })
    } catch (error) {
      logger.error('Failed to get WebSocket config', { error })
      handleError(error, res)
    }
  }
)

/**
 * GET /api/public/avatar/stream/:conversationId
 * Get avatar stream URL for a conversation
 */
router.get(
  '/avatar/stream/:conversationId',
  authenticateApiKey,
  async (req: ApiKeyRequest, res) => {
    try {
      const { conversationId } = req.params

      // Verify conversation exists
      const conversation = await Conversation.findOne({
        _id: conversationId,
      })

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      // If companyId wasn't set by middleware (route without agentId), set it from conversation
      if (!req.companyId) {
        req.companyId = conversation.company_id
        req.agentId = conversation.agent_id
      } else {
        // Verify conversation belongs to company
        if (conversation.company_id !== req.companyId) {
          return res.status(403).json({ error: 'Conversation does not belong to company' })
        }
      }

      // For MVP: Return placeholder stream URL
      // In production, this will connect to Avatar Service
      const avatarServiceUrl = process.env.AVATAR_SERVICE_URL || 'http://localhost:4009'
      const streamUrl = `${avatarServiceUrl}/ws/avatar/${conversationId}`

      logger.info('Avatar stream URL requested', { conversationId })

      res.json({
        streamUrl,
        conversationId,
      })
    } catch (error) {
      logger.error('Failed to get avatar stream', { error })
      handleError(error, res)
    }
  }
)

/**
 * Helper function to generate agent response for widget
 * (Simplified version without Socket.io)
 */
async function generateAgentResponseForWidget(
  conversationId: string,
  userMessage: string,
  agentId: string,
  companyId: string,
  threadId: string | null
): Promise<void> {
  try {
    // Get agent config
    const { data: agent, error: agentError } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('id', agentId)
      .eq('company_id', companyId)
      .single()

    if (agentError || !agent) {
      throw new Error('Agent not found')
    }

    // Get conversation messages for context
    const messages = await Message.find({
      conversation_id: conversationId,
      thread_id: threadId || { $exists: false },
    })
      .sort({ created_at: 1 })
      .limit(20)
      .lean()

    // Build conversation history
    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }))

    // Retrieve knowledge base context if enabled
    let knowledgeBaseContext: string | undefined
    try {
      const knowledgeBaseServiceUrl =
        process.env.KNOWLEDGE_BASE_SERVICE_URL || 'http://localhost:4005'

      const searchResponse = await fetch(`${knowledgeBaseServiceUrl}/api/documents/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage,
          companyId,
          agentId: agent.id,
          topK: 5,
        }),
      })

      if (searchResponse.ok) {
        const searchData = (await searchResponse.json()) as {
          results?: Array<{ metadata?: { [key: string]: unknown }; score?: number }>
        }
        if (searchData.results && searchData.results.length > 0) {
          knowledgeBaseContext = searchData.results
            .map((r) => (r.metadata?.text as string) || '')
            .join('\n\n')
        }
      }
    } catch (error) {
      logger.warn('Failed to retrieve knowledge base context', { error, conversationId })
    }

    // Generate response using OpenAI service
    const response = await generateResponse({
      systemPrompt: agent.system_prompt || 'You are a helpful AI assistant.',
      userMessage,
      conversationHistory,
      knowledgeBaseContext,
      model: agent.model || 'gpt-4o-mini',
      temperature: agent.temperature || 0.7,
    })

    // Save agent response message
    const agentMessage = await Message.create({
      conversation_id: conversationId,
      thread_id: threadId || null,
      sender_type: 'agent',
      role: 'assistant',
      content: response.response,
      message_type: 'text',
      ai_metadata: {
        model: agent.model,
        tokens_used: response.tokensUsed,
      },
    })

    // Notify Chat Service to emit the message via WebSocket
    try {
      const chatServiceUrl = process.env.CHAT_SERVICE_URL || 'http://localhost:4004'
      const internalToken = process.env.INTERNAL_SERVICE_TOKEN || 'internal-token'
      
      const emitResponse = await fetch(`${chatServiceUrl}/api/internal/messages/emit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalToken}`,
        },
        body: JSON.stringify({
          conversationId,
          message: {
            _id: String(agentMessage._id),
            conversation_id: conversationId,
            thread_id: threadId || null,
            sender_type: 'agent' as const,
            role: 'assistant' as const,
            content: response.response,
            message_type: 'text',
            ai_metadata: {
              model: agent.model,
              tokens_used: response.tokensUsed,
            },
            created_at: agentMessage.created_at.toISOString(),
          },
        }),
      })
      
      if (!emitResponse.ok) {
        const errorText = await emitResponse.text()
        logger.warn('Chat Service returned error when emitting message', {
          status: emitResponse.status,
          statusText: emitResponse.statusText,
          error: errorText,
          conversationId,
        })
      }
    } catch (error) {
      logger.warn('Failed to notify Chat Service about agent response', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        conversationId,
      })
      // Continue anyway - message is saved, widget can poll if needed
    }

    logger.info('Agent response generated for widget', {
      conversationId,
      responseLength: response.response.length,
    })
  } catch (error) {
    logger.error('Failed to generate agent response for widget', { error, conversationId })
    throw error
  }
}

export default router

