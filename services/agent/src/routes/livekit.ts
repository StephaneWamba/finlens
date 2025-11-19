/**
 * LiveKit API Routes
 * Handles token generation and room management
 */

import express from 'express'
import { z } from 'zod'
import { authenticate, requireCompany, AuthenticatedRequest } from '../middleware/auth.js'
import { supabase } from '../config/database.js'
import { generateAccessToken, getRoomName, getLiveKitUrl, getUserPermissions, getAgentPermissions } from '../services/livekit.js'
import { handleError, badRequest } from '../utils/errors.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:livekit')
const router = express.Router()

// Request schemas
const GenerateTokenSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required'),
  agentId: z.string().uuid('Invalid agent ID format'),
  participantType: z.enum(['user', 'agent']).default('user'),
})

/**
 * POST /api/livekit/token
 * Generate access token for LiveKit room
 */
router.post(
  '/token',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const validationResult = GenerateTokenSchema.safeParse(req.body)
      if (!validationResult.success) {
        return badRequest(res, validationResult.error.issues[0].message)
      }

      const { conversationId, agentId, participantType } = validationResult.data
      const userId = req.user!.id
      const companyId = req.user!.company_id!

      // Verify agent belongs to company
      const { data: agent, error: agentError } = await supabase
        .from('agent_configs')
        .select('id, company_id')
        .eq('id', agentId)
        .eq('company_id', companyId)
        .single()

      if (agentError || !agent) {
        logger.warn('Agent not found or access denied', { agentId, companyId })
        return res.status(404).json({ error: 'Agent not found' })
      }

      const roomName = getRoomName(conversationId)
      const identity = participantType === 'user' ? userId : `agent:${agentId}`
      const permissions = participantType === 'user' ? getUserPermissions() : getAgentPermissions()

      const token = await generateAccessToken({
        identity,
        roomName,
        permissions,
        metadata: JSON.stringify({
          userId: participantType === 'user' ? userId : undefined,
          agentId: participantType === 'agent' ? agentId : undefined,
          companyId,
          conversationId,
        }),
      })

      logger.info('LiveKit token generated', {
        conversationId,
        agentId,
        participantType,
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

export default router

