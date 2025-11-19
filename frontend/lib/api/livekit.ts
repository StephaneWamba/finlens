/**
 * LiveKit API Client
 * React Query hooks for LiveKit operations
 */

'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface LiveKitTokenResponse {
  token: string
  url: string
  roomName: string
  identity: string
}

export interface GenerateTokenInput {
  conversationId: string
  agentId: string
  participantType?: 'user' | 'agent'
}

// API functions
async function generateToken(input: GenerateTokenInput): Promise<LiveKitTokenResponse> {
  const AGENT_SERVICE_URL = process.env.NEXT_PUBLIC_AGENT_SERVICE_URL || 'http://localhost:4002'
  
  const response = await fetch(`${AGENT_SERVICE_URL}/api/livekit/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getAuthToken()}`,
    },
    body: JSON.stringify({
      conversationId: input.conversationId,
      agentId: input.agentId,
      participantType: input.participantType || 'user',
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to generate token' }))
    throw new Error(error.error || 'Failed to generate token')
  }

  return await response.json()
}

async function getAuthToken(): Promise<string> {
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }
  
  return session.access_token
}

async function deployVoiceBot(input: { conversationId: string; agentId: string }): Promise<{ success: boolean; message: string; agentJobId: string }> {
  const AGENT_SERVICE_URL = process.env.NEXT_PUBLIC_AGENT_SERVICE_URL || 'http://localhost:4002'
  
  const response = await fetch(`${AGENT_SERVICE_URL}/api/voice-bot/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getAuthToken()}`,
    },
    body: JSON.stringify({
      conversationId: input.conversationId,
      agentId: input.agentId,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to deploy voice bot' }))
    throw new Error(error.error || 'Failed to deploy voice bot')
  }

  return await response.json()
}

// React Query hooks
export function useGenerateLiveKitToken() {
  return useMutation({
    mutationFn: generateToken,
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate LiveKit token')
    },
  })
}

export function useDeployVoiceBot() {
  return useMutation({
    mutationFn: deployVoiceBot,
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to deploy voice bot')
    },
    onSuccess: () => {
      toast.success('Agent deployed successfully')
    },
  })
}

