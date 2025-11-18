/**
 * Agent CRUD Routes
 */

import express from 'express'
import { supabase } from '../config/database.js'
import { authenticate, requireCompany, AuthenticatedRequest } from '../middleware/auth.js'
import { CreateAgentSchema, UpdateAgentSchema } from '../schemas/agent.js'
import { handleError, notFound, forbidden, badRequest } from '../utils/errors.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service')
const router = express.Router()

/**
 * GET /api/agents
 * List all agents for the authenticated user's company
 */
router.get(
  '/',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const companyId = req.user!.company_id!

      const { data: agents, error } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Failed to fetch agents', { error: error.message })
        return res.status(500).json({ error: 'Failed to fetch agents' })
      }

      res.json({ agents: agents || [] })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * GET /api/agents/:id
 * Get a specific agent by ID
 */
router.get(
  '/:id',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const companyId = req.user!.company_id!

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(id)) {
        logger.warn('Invalid agent ID format', { id })
        return badRequest(res, `Invalid agent ID format. Expected UUID, got: ${id}`)
      }

      const { data: agent, error } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return notFound(res, 'Agent', id)
        }
        // Handle UUID format errors from Supabase
        if (error.message?.includes('invalid input syntax for type uuid')) {
          logger.warn('Invalid UUID format from Supabase', { id, error: error.message })
          return badRequest(res, `Invalid agent ID format: ${id}`)
        }
        logger.error('Failed to fetch agent', { error: error.message })
        return res.status(500).json({ error: 'Failed to fetch agent' })
      }

      res.json({ agent })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * POST /api/agents
 * Create a new agent
 */
router.post(
  '/',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      // Validate input
      const validationResult = CreateAgentSchema.safeParse(req.body)
      if (!validationResult.success) {
        return badRequest(res, validationResult.error.issues[0].message)
      }

      const companyId = req.user!.company_id!
      const agentData = validationResult.data

      // Insert agent
      const { data: agent, error } = await supabase
        .from('agent_configs')
        .insert({
          company_id: companyId,
          name: agentData.name,
          description: agentData.description || null,
          system_prompt: agentData.system_prompt,
          model: agentData.model,
          temperature: agentData.temperature,
          max_tokens: agentData.max_tokens,
          enabled: agentData.enabled,
          voice_settings: agentData.voice_settings || {},
        })
        .select()
        .single()

      if (error) {
        logger.error('Failed to create agent', { error: error.message })
        return res.status(500).json({ error: 'Failed to create agent' })
      }

      logger.info('Agent created', { agentId: agent.id, companyId })
      res.status(201).json({ agent })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * PATCH /api/agents/:id
 * Update an existing agent
 */
router.patch(
  '/:id',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const companyId = req.user!.company_id!

      // Validate input
      const validationResult = UpdateAgentSchema.safeParse(req.body)
      if (!validationResult.success) {
        return badRequest(res, validationResult.error.issues[0].message)
      }

      // Check if agent exists and belongs to company
      const { data: existingAgent, error: fetchError } = await supabase
        .from('agent_configs')
        .select('id, company_id')
        .eq('id', id)
        .single()

      if (fetchError || !existingAgent) {
        return notFound(res, 'Agent', id)
      }

      if (existingAgent.company_id !== companyId) {
        return forbidden(res, 'Agent does not belong to your company')
      }

      // Update agent
      const updateData = validationResult.data
      const { data: agent, error } = await supabase
        .from('agent_configs')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single()

      if (error) {
        logger.error('Failed to update agent', { error: error.message })
        return res.status(500).json({ error: 'Failed to update agent' })
      }

      logger.info('Agent updated', { agentId: id })
      res.json({ agent })
    } catch (error) {
      handleError(error, res)
    }
  }
)

/**
 * DELETE /api/agents/:id
 * Delete an agent
 */
router.delete(
  '/:id',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const companyId = req.user!.company_id!

      // Check if agent exists and belongs to company
      const { data: existingAgent, error: fetchError } = await supabase
        .from('agent_configs')
        .select('id, company_id')
        .eq('id', id)
        .single()

      if (fetchError || !existingAgent) {
        return notFound(res, 'Agent', id)
      }

      if (existingAgent.company_id !== companyId) {
        return forbidden(res, 'Agent does not belong to your company')
      }

      // Delete agent
      const { error } = await supabase
        .from('agent_configs')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId)

      if (error) {
        logger.error('Failed to delete agent', { error: error.message })
        return res.status(500).json({ error: 'Failed to delete agent' })
      }

      logger.info('Agent deleted', { agentId: id })
      res.status(204).send()
    } catch (error) {
      handleError(error, res)
    }
  }
)

export default router

