/**
 * Call Recordings API
 * React Query hooks for call recordings and history
 */

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface CallRecording {
  id: string
  company_id: string
  conversation_id: string
  agent_id?: string
  contact_id?: string
  user_id?: string
  room_name: string
  room_id?: string
  duration_seconds: number
  started_at: string
  ended_at?: string
  recording_url?: string
  recording_storage_path?: string
  file_size_bytes?: number
  mime_type: string
  participants: string[]
  metadata: Record<string, unknown>
  status: 'recording' | 'completed' | 'failed' | 'processing'
  created_at: string
  updated_at: string
}

export interface CallHistory {
  id: string
  company_id: string
  conversation_id: string
  agent_id?: string
  contact_id?: string
  user_id?: string
  room_name: string
  call_type: 'voice' | 'video'
  duration_seconds: number
  started_at: string
  ended_at?: string
  has_recording: boolean
  recording_id?: string
  participant_count: number
  participants: string[]
  status: 'completed' | 'failed' | 'missed' | 'cancelled'
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
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

const AGENT_SERVICE_URL = process.env.NEXT_PUBLIC_AGENT_SERVICE_URL || 'http://localhost:4002'

// API functions
async function createRecording(data: {
  conversationId: string
  agentId?: string
  roomName: string
  roomId?: string
  startedAt: string
}): Promise<{ success: boolean; recording: CallRecording }> {
  const response = await fetch(`${AGENT_SERVICE_URL}/api/call-recordings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getAuthToken()}`,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create recording' }))
    throw new Error(error.error || 'Failed to create recording')
  }

  return await response.json()
}

async function updateRecording(
  id: string,
  data: {
    endedAt?: string
    durationSeconds?: number
    recordingUrl?: string
    recordingStoragePath?: string
    fileSizeBytes?: number
    participants?: string[]
    status?: 'recording' | 'completed' | 'failed' | 'processing'
  }
): Promise<{ success: boolean; recording: CallRecording }> {
  const response = await fetch(`${AGENT_SERVICE_URL}/api/call-recordings/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getAuthToken()}`,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update recording' }))
    throw new Error(error.error || 'Failed to update recording')
  }

  return await response.json()
}

async function getRecordings(conversationId?: string): Promise<{ success: boolean; recordings: CallRecording[] }> {
  const params = new URLSearchParams()
  if (conversationId) {
    params.append('conversationId', conversationId)
  }

  const response = await fetch(`${AGENT_SERVICE_URL}/api/call-recordings?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${await getAuthToken()}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch recordings')
  }

  return await response.json()
}

async function getRecording(id: string): Promise<{ success: boolean; recording: CallRecording }> {
  const response = await fetch(`${AGENT_SERVICE_URL}/api/call-recordings/${id}`, {
    headers: {
      'Authorization': `Bearer ${await getAuthToken()}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch recording')
  }

  return await response.json()
}

async function getCallHistory(params?: {
  conversationId?: string
  contactId?: string
  limit?: number
  offset?: number
}): Promise<{ success: boolean; history: CallHistory[]; pagination: { limit: number; offset: number; hasMore: boolean } }> {
  const searchParams = new URLSearchParams()
  if (params?.conversationId) searchParams.append('conversationId', params.conversationId)
  if (params?.contactId) searchParams.append('contactId', params.contactId)
  if (params?.limit) searchParams.append('limit', params.limit.toString())
  if (params?.offset) searchParams.append('offset', params.offset.toString())

  const response = await fetch(`${AGENT_SERVICE_URL}/api/call-recordings/history?${searchParams.toString()}`, {
    headers: {
      'Authorization': `Bearer ${await getAuthToken()}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch call history')
  }

  return await response.json()
}

// React Query hooks
export function useCreateRecording() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createRecording,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['call-recordings'] })
      queryClient.invalidateQueries({ queryKey: ['call-history'] })
      toast.success('Recording started')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create recording')
    },
  })
}

export function useUpdateRecording() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateRecording>[1] }) =>
      updateRecording(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-recordings'] })
      queryClient.invalidateQueries({ queryKey: ['call-history'] })
      toast.success('Recording updated')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update recording')
    },
  })
}

export function useRecordings(conversationId?: string) {
  return useQuery({
    queryKey: ['call-recordings', conversationId],
    queryFn: () => getRecordings(conversationId),
    select: (data) => data.recordings,
  })
}

export function useRecording(
  id: string,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['call-recording', id],
    queryFn: () => getRecording(id),
    select: (data) => data.recording,
    enabled: options?.enabled !== false && !!id,
  })
}

export function useCallHistory(params?: {
  conversationId?: string
  contactId?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: ['call-history', params],
    queryFn: () => getCallHistory(params),
  })
}

