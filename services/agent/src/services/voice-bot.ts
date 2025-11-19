/**
 * LiveKit Voice Bot Service
 * Deploys AI agent bots to join LiveKit rooms and handle voice interactions
 */

import { Room } from 'livekit-client'
import { createLogger } from '@syntera/shared/logger/index.js'
import { generateAccessToken, getRoomName, getAgentPermissions, getLiveKitUrl } from './livekit.js'
import { createClient } from '@supabase/supabase-js'

const logger = createLogger('agent-service:voice-bot')

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface AgentConfig {
  agentId: string
  name: string
  model: string
  systemPrompt?: string
  temperature?: number
}

/**
 * Get agent configuration from Supabase
 */
async function getAgentConfig(agentId: string): Promise<AgentConfig> {
  const { data: agent, error } = await supabase
    .from('agent_configs')
    .select('id, name, model, system_prompt, temperature')
    .eq('id', agentId)
    .single()

  if (error || !agent) {
    throw new Error(`Agent ${agentId} not found`)
  }

  return {
    agentId: agent.id,
    name: agent.name || 'AI Assistant',
    model: agent.model || 'gpt-4o-mini',
    systemPrompt: agent.system_prompt || 'You are a helpful AI assistant.',
    temperature: agent.temperature || 0.7,
  }
}

/**
 * Connect agent bot to a LiveKit room
 */
export async function connectAgentToRoom(
  agentId: string,
  conversationId: string,
  userId: string
): Promise<Room> {
  try {
    const config = await getAgentConfig(agentId)
    const roomName = getRoomName(conversationId)
    const identity = `agent:${agentId}`

    // Generate token for agent
    const token = await generateAccessToken({
      identity,
      roomName,
      permissions: getAgentPermissions(),
      metadata: JSON.stringify({
        agentId,
        conversationId,
        userId,
        agentName: config.name,
      }),
    })

    const url = getLiveKitUrl()
    if (!url) {
      throw new Error('LIVEKIT_URL is not configured')
    }

    // Create room and connect
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    })

    await room.connect(url, token)

    logger.info('Agent bot connected to room', {
      agentId,
      conversationId,
      roomName,
      identity,
      agentName: config.name,
    })

    // Set up room event handlers
    room.on('participantConnected', (participant) => {
      logger.info('Participant connected to agent room', {
        agentId,
        conversationId,
        participantIdentity: participant.identity,
      })
    })

    room.on('trackSubscribed', () => {
      // Track subscription handled automatically
    })

    room.on('disconnected', () => {
      logger.info('Agent bot disconnected from room', {
        agentId,
        conversationId,
      })
    })

    return room
  } catch (error) {
    logger.error('Failed to connect agent to room', {
      agentId,
      conversationId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

