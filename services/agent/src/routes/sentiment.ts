/**
 * Sentiment Analysis Route
 * POST /api/responses/sentiment
 */

import express, { Request, Response } from 'express'
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js'
import { analyzeSentiment } from '../utils/sentiment-analysis.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { z } from 'zod'

const logger = createLogger('agent-service:sentiment')
const router: express.Router = express.Router()

// Request schema
const AnalyzeSentimentSchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000, 'Message too long'),
})

/**
 * POST /api/responses/sentiment
 * Analyze sentiment from a user message
 */
router.post(
  '/sentiment',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate input
      const validationResult = AnalyzeSentimentSchema.safeParse(req.body)
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request',
          details: validationResult.error.issues[0].message,
        })
      }

      const { message } = validationResult.data

      // Analyze sentiment
      const sentimentResult = await analyzeSentiment(message)

      logger.debug('Sentiment analyzed', {
        sentiment: sentimentResult.sentiment,
        score: sentimentResult.score,
        confidence: sentimentResult.confidence,
      })

      res.json(sentimentResult)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to analyze sentiment', { error: errorMessage })
      res.status(500).json({ error: 'Failed to analyze sentiment' })
    }
  }
)

export default router




