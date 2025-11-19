/**
 * Voice Bot Routes
 * API endpoints for deploying and managing AI agent voice bots
 */

import express from 'express'
import { z } from 'zod'
import { authenticate, requireCompany, type AuthenticatedRequest } from '../middleware/auth.js'
import { badRequest, handleError } from '../utils/errors.js'
import { connectAgentToRoom } from '../services/voice-bot.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:voice-bot-routes')
const router = express.Router()

const DeployBotSchema = z.object({
  conversationId: z.string().min(1),
  agentId: z.string().uuid(),
})

/**
 * POST /api/voice-bot/deploy
 * Deploy an AI agent bot to a LiveKit room
 */
router.post(
  '/deploy',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const validationResult = DeployBotSchema.safeParse(req.body)
      if (!validationResult.success) {
        return badRequest(res, validationResult.error.issues[0].message)
      }

      const { conversationId, agentId } = validationResult.data
      const userId = req.user!.id
      const companyId = req.user!.company_id!

      logger.info('Deploying voice bot', {
        conversationId,
        agentId,
        userId,
        companyId,
      })

      // Generate token for agent
      const { generateAccessToken, getRoomName, getAgentPermissions } = await import('../services/livekit.js')
      const roomName = getRoomName(conversationId)
      const identity = `agent:${agentId}`

      const token = await generateAccessToken({
        identity,
        roomName,
        permissions: getAgentPermissions(),
        metadata: JSON.stringify({
          agentId,
          conversationId,
          userId,
        }),
      })

      // Dispatch agent via Python service
      // Default to 4008 to match Python service default API_SERVER_PORT
      const pythonServiceUrl = process.env.PYTHON_AGENT_SERVICE_URL || 'http://localhost:4008'
      
      logger.info('Dispatching agent to Python service', {
        conversationId,
        agentId,
        pythonServiceUrl,
      })

      const dispatchResponse = await fetch(`${pythonServiceUrl}/api/agents/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          agentId,
          userId,
          roomName,
          token,
        }),
      })

      if (!dispatchResponse.ok) {
        const errorText = await dispatchResponse.text()
        logger.error('Failed to dispatch Python agent', {
          status: dispatchResponse.status,
          error: errorText,
        })
        throw new Error(`Failed to dispatch agent: ${errorText}`)
      }

      const result = (await dispatchResponse.json()) as {
        success: boolean
        agentJobId: string
        message: string
      }

      logger.info('Voice bot deployed successfully', {
        conversationId,
        agentId,
        roomName,
        agentJobId: result.agentJobId,
      })

      res.json({
        success: true,
        message: 'Voice bot deployed successfully',
        conversationId,
        agentId,
        roomName,
        agentJobId: result.agentJobId,
      })
    } catch (error) {
      logger.error('Failed to deploy voice bot', { error })
      handleError(error, res)
    }
  }
)

export default router

