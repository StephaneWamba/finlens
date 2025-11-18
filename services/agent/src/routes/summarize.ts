/**
 * Conversation Summarization Route
 * POST /api/responses/summarize
 */

import express, { Request, Response } from 'express'
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js'
import { generateConversationSummary } from '../utils/summarization.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { z } from 'zod'

const logger = createLogger('agent-service:summarize')
const router: express.Router = express.Router()

// Request schema
const SummarizeSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).min(1, 'At least one message is required'),
})

/**
 * POST /api/responses/summarize
 * Generate a summary of conversation messages
 */
router.post(
  '/summarize',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate input
      const validationResult = SummarizeSchema.safeParse(req.body)
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request',
          details: validationResult.error.issues[0].message,
        })
      }

      const { messages } = validationResult.data

      // Generate summary
      const summary = await generateConversationSummary(messages)

      logger.info('Conversation summary generated', {
        messageCount: messages.length,
        summaryLength: summary.length,
      })

      res.json({
        summary,
        messageCount: messages.length,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to generate summary', { error: errorMessage })
      res.status(500).json({ error: 'Failed to generate summary' })
    }
  }
)

export default router