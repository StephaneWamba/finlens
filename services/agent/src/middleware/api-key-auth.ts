/**
 * API Key Authentication Middleware
 * For public widget endpoints
 */

import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/database.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:api-key-auth')

export interface ApiKeyRequest extends Request {
  apiKey?: string
  agentId?: string
  companyId?: string
}

/**
 * Middleware to verify API key and extract agent/company info
 * API keys are stored in agent_configs table with format: pub_key_xxx
 */
export async function authenticateApiKey(
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Get API key from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' })
    }

    const apiKey = authHeader.substring(7) // Remove 'Bearer ' prefix

    // For MVP: Simple API key validation
    // In production, store API keys in database with agent_id mapping
    // For now, we'll extract agent_id from the request and validate the key format
    
    // Check if API key format is valid (starts with pub_key_)
    if (!apiKey.startsWith('pub_key_')) {
      logger.warn('Invalid API key format', { apiKey: apiKey.substring(0, 10) + '...' })
      return res.status(401).json({ error: 'Invalid API key format' })
    }

    // Extract agent ID from request
    // Express populates req.params when route matches, so this should work
    // Also try URL parsing as fallback
    let agentId = req.params?.agentId || 
                  req.body?.agentId || 
                  (req.url.match(/\/agents\/([a-f0-9-]{36})/i)?.[1]) ||
                  (req.path.match(/\/agents\/([a-f0-9-]{36})/i)?.[1])
    
    // For routes that don't have agentId in URL/body (like /messages, /avatar/stream),
    // we'll extract it from the conversation after verifying the API key
    // For now, we'll allow these routes to proceed without agentId initially
    // and extract it from the conversation in the route handler
    const isRouteWithoutAgentId = req.path.includes('/messages') || 
                                   req.path.includes('/avatar/stream') ||
                                   req.path.includes('/livekit/token') ||
                                   req.path.includes('/websocket/config')
    
    if (!agentId && !isRouteWithoutAgentId) {
      return res.status(400).json({ error: 'Agent ID is required' })
    }
    
    // If we have an agentId, proceed with validation
    // If not (for routes like /messages), we'll skip agent validation for now
    // and let the route handler extract agentId from the conversation
    if (!agentId && isRouteWithoutAgentId) {
      // For MVP: Allow these routes to proceed without agentId validation
      // The route handler will verify the conversation belongs to the company
      // In production, we should validate the API key against a stored key per agent
      req.apiKey = apiKey
      // agentId and companyId will be set by route handler after conversation lookup
      next()
      return
    }

    // Verify agent exists and get company_id
    const { data: agent, error: agentError } = await supabase
      .from('agent_configs')
      .select('id, company_id')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      logger.warn('Agent not found', { 
        agentId, 
        error: agentError?.message,
        errorCode: agentError?.code,
        errorDetails: agentError,
        queryAttempted: true,
      })
      
      // Ensure response is sent with proper JSON
      res.status(404).json({ 
        error: 'Agent not found',
        agentId,
        details: agentError?.message || 'Agent does not exist',
        errorCode: agentError?.code || 'UNKNOWN',
      })
      return
    }
    
    logger.debug('Agent found in middleware', {
      agentId: agent.id,
      companyId: agent.company_id,
    })

    // For MVP: Simple key validation
    // In production, compare with stored public_api_key or use proper key management
    // For now, we'll just verify the agent exists and allow if key format is valid
    // TODO: Implement proper API key validation against stored keys

    // Attach info to request
    req.apiKey = apiKey
    req.agentId = agentId
    req.companyId = agent.company_id

    next()
  } catch (error) {
    logger.error('API key authentication error', { error })
    return res.status(500).json({ error: 'Authentication error' })
  }
}

