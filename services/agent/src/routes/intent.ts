/**
 * Intent Detection Route
 * POST /api/responses/detect-intent
 */

import express, { Request, Response } from 'express'
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js'
import { detectIntent } from '../utils/intent-detection.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { z } from 'zod'

const logger = createLogger('agent-service:intent')
const router: express.Router = express.Router()

// Request schema
const DetectIntentSchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000, 'Message too long'),
})

/**
 * POST /api/responses/detect-intent
 * Detect intent from a user message
 */
router.post(
  '/detect-intent',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate input
      const validationResult = DetectIntentSchema.safeParse(req.body)
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request',
          details: validationResult.error.issues[0].message,
        })
      }

      const { message } = validationResult.data

      // Detect intent
      const intentResult = await detectIntent(message)

      logger.debug('Intent detected', {
        intent: intentResult.intent,
        confidence: intentResult.confidence,
      })

      res.json(intentResult)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to detect intent', { error: errorMessage })
      res.status(500).json({ error: 'Failed to detect intent' })
    }
  }
)

export default router

