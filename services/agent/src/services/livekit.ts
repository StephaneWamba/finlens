/**
 * LiveKit Service
 * Handles token generation and room management for LiveKit
 */

import { AccessToken } from 'livekit-server-sdk'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:livekit')

export interface ParticipantPermissions {
  canPublish: boolean
  canSubscribe: boolean
  canPublishData: boolean
  roomRecord?: boolean
}

export interface TokenOptions {
  identity: string
  roomName: string
  permissions: ParticipantPermissions
  metadata?: string
  ttl?: number // Time to live in seconds, default 1 hour
}

/**
 * Validate LiveKit configuration
 */
export function validateLiveKitConfig(): boolean {
  const url = process.env.LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET

  if (!url || !apiKey || !apiSecret) {
    logger.warn('LiveKit configuration incomplete', {
      hasUrl: !!url,
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
    })
    return false
  }

  if (!url.startsWith('wss://')) {
    logger.warn('LiveKit URL must use wss:// protocol', { url })
    return false
  }

  return true
}

/**
 * Generate LiveKit access token
 */
export async function generateAccessToken(options: TokenOptions): Promise<string> {
  const { identity, roomName, permissions, metadata, ttl = 3600 } = options

  if (!validateLiveKitConfig()) {
    throw new Error('LiveKit configuration is invalid')
  }

  const apiKey = process.env.LIVEKIT_API_KEY?.trim()
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim()

  if (!apiKey || !apiSecret) {
    throw new Error('LiveKit API key or secret is missing')
  }

  try {
    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: ttl,
    })

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: permissions.canPublish,
      canSubscribe: permissions.canSubscribe,
      canPublishData: permissions.canPublishData,
      roomRecord: permissions.roomRecord || false,
    })

    if (metadata) {
      token.metadata = metadata
    }

    const jwt = await token.toJwt()
    logger.info('Token generated successfully', {
      identity,
      roomName,
    })
    return jwt
  } catch (error) {
    logger.error('Token generation failed', {
      error: error instanceof Error ? error.message : String(error),
      identity,
      roomName,
    })
    throw error
  }
}

/**
 * Generate room name from conversation ID
 */
export function getRoomName(conversationId: string): string {
  return `conversation:${conversationId}`
}

/**
 * Get LiveKit server URL
 */
export function getLiveKitUrl(): string {
  const url = process.env.LIVEKIT_URL
  if (!url) {
    throw new Error('LIVEKIT_URL is not configured')
  }
  return url
}

/**
 * Get user permissions for LiveKit room
 */
export function getUserPermissions(): ParticipantPermissions {
  return {
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  }
}

/**
 * Get agent permissions for LiveKit room
 */
export function getAgentPermissions(): ParticipantPermissions {
  return {
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  }
}

