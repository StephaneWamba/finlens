/**
 * Conversation REST API Routes
 */

import express from 'express'
import { Conversation, Message } from '@syntera/shared/models'
import { createLogger } from '@syntera/shared/logger/index.js'
import { authenticate, requireCompany, AuthenticatedRequest } from './middleware/auth.js'
import { getCache, setCache, getMessagesCacheKey, invalidateConversationCache } from '../utils/cache.js'

const logger = createLogger('chat-service:api')
const router = express.Router()

/**
 * GET /api/conversations
 * List all conversations for the authenticated user's company
 */
router.get(
  '/',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const companyId = req.user!.company_id!
      const { status, channel, limit = 50, offset = 0 } = req.query

      const query: Record<string, unknown> = {
        company_id: companyId,
      }

      if (status) {
        query.status = status
      }

      if (channel) {
        query.channel = channel
      }

      // Optimize query with field selection
      const conversations = await Conversation.find(query)
        .select('_id agent_id company_id contact_id user_id channel status started_at ended_at tags metadata created_at updated_at')
        .sort({ started_at: -1 })
        .limit(Math.min(Number(limit), 50)) // Cap at 50 for performance
        .skip(Number(offset))
        .lean()

      const total = await Conversation.countDocuments(query)

      res.json({
        conversations,
        total,
        limit: Number(limit),
        offset: Number(offset),
      })
    } catch (error) {
      logger.error('Failed to fetch conversations', { error })
      res.status(500).json({ error: 'Failed to fetch conversations' })
    }
  }
)

/**
 * GET /api/conversations/:id
 * Get a specific conversation by ID
 */
router.get(
  '/:id',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const companyId = req.user!.company_id!

      const conversation = await Conversation.findOne({
        _id: id,
        company_id: companyId,
      }).lean()

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      res.json({ conversation })
    } catch (error) {
      logger.error('Failed to fetch conversation', { error })
      res.status(500).json({ error: 'Failed to fetch conversation' })
    }
  }
)

/**
 * GET /api/conversations/:id/messages
 * Get messages for a conversation
 */
router.get(
  '/:id/messages',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const companyId = req.user!.company_id!
      const limit = Number(req.query.limit) || 100
      const offset = Number(req.query.offset) || 0

      // Verify conversation belongs to company
      const conversation = await Conversation.findOne({
        _id: id,
        company_id: companyId,
      }).select('_id company_id').lean()

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      // Try cache first
      const cacheKey = getMessagesCacheKey(id, limit, offset)
      const cached = await getCache<{ messages: unknown[]; total: number }>(cacheKey)
      if (cached) {
        return res.json({
          messages: cached.messages,
          total: cached.total,
          limit,
          offset,
        })
      }

      // Query messages with field selection for better performance
      const messages = await Message.find({
        conversation_id: id,
      })
        .select('_id conversation_id sender_type role content message_type attachments ai_metadata metadata created_at')
        .sort({ created_at: 1 })
        .limit(limit)
        .skip(offset)
        .lean()

      const total = await Message.countDocuments({ conversation_id: id })

      // Cache result
      await setCache(cacheKey, { messages, total }, 30) // 30 second cache

      res.json({
        messages,
        total,
        limit: Number(limit),
        offset: Number(offset),
      })
    } catch (error) {
      logger.error('Failed to fetch messages', { error })
      res.status(500).json({ error: 'Failed to fetch messages' })
    }
  }
)

/**
 * PATCH /api/conversations/:id
 * Update conversation (e.g., end conversation, add tags)
 */
router.patch(
  '/:id',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const companyId = req.user!.company_id!
      const { status, tags, metadata } = req.body

      const conversation = await Conversation.findOneAndUpdate(
        {
          _id: id,
          company_id: companyId,
        },
        {
          ...(status && { status }),
          ...(tags && { tags }),
          ...(metadata && { metadata }),
          updated_at: new Date(),
        },
        { new: true }
      ).lean()

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      res.json({ conversation })
    } catch (error) {
      logger.error('Failed to update conversation', { error })
      res.status(500).json({ error: 'Failed to update conversation' })
    }
  }
)

/**
 * PATCH /api/conversations/:id/messages/:messageId
 * Update a message (mark as read, add reaction, etc.)
 */
router.patch(
  '/:id/messages/:messageId',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id: conversationId, messageId } = req.params
      const companyId = req.user!.company_id!
      const userId = req.user!.id
      const { markAsRead, reaction } = req.body

      // Verify conversation belongs to company
      const conversation = await Conversation.findOne({
        _id: conversationId,
        company_id: companyId,
      })

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' })
      }

      // Get current message
      const message = await Message.findOne({
        _id: messageId,
        conversation_id: conversationId,
      })

      if (!message) {
        return res.status(404).json({ error: 'Message not found' })
      }

      const updateData: any = {}

      // Mark as read
      if (markAsRead) {
        updateData['metadata.read_at'] = new Date()
      }

      // Add or remove reaction
      if (reaction !== undefined) {
        const currentReactions = (message.metadata?.reactions as Array<{ emoji: string; user_id: string; created_at: Date }>) || []
        
        if (reaction === null) {
          // Remove user's reaction
          updateData['metadata.reactions'] = currentReactions.filter((r) => r.user_id !== userId)
        } else {
          // Add or update reaction
          const existingIndex = currentReactions.findIndex(
            (r) => r.user_id === userId && r.emoji === reaction
          )
          
          if (existingIndex >= 0) {
            // Remove if same emoji (toggle)
            updateData['metadata.reactions'] = currentReactions.filter((r) => r.user_id !== userId || r.emoji !== reaction)
          } else {
            // Add new reaction
            updateData['metadata.reactions'] = [
              ...currentReactions.filter((r) => r.user_id !== userId),
              {
                emoji: reaction,
                user_id: userId,
                created_at: new Date(),
              },
            ]
          }
        }
      }

      // Update message
      const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        { $set: updateData },
        { new: true }
      ).lean()

      // Invalidate cache for this conversation's messages
      await invalidateConversationCache(conversationId)

      res.json({ message: updatedMessage })
    } catch (error) {
      logger.error('Failed to update message', { error })
      res.status(500).json({ error: 'Failed to update message' })
    }
  }
)

export default router

