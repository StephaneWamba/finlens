/**
 * Agent API Client
 * React Query hooks for agent operations
 */

'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface VoiceSettings {
  voice?: string
  language?: string
  speed?: number
  pitch?: number
  video_enabled?: boolean
  screen_sharing_enabled?: boolean
  video_quality?: 'sd' | 'hd' | 'full-hd'
}

export interface Agent {
  id: string
  company_id: string
  name: string
  description?: string | null
  system_prompt: string
  model: string
  temperature: number
  max_tokens: number
  enabled: boolean
  voice_settings?: VoiceSettings | null
  created_at: string
  updated_at: string
}

export interface CreateAgentInput {
  name: string
  description?: string
  system_prompt: string
  model?: string
  temperature?: number
  max_tokens?: number
  enabled?: boolean
  voice_settings?: Record<string, unknown>
}

export interface UpdateAgentInput {
  name?: string
  description?: string
  system_prompt?: string
  model?: string
  temperature?: number
  max_tokens?: number
  enabled?: boolean
  voice_settings?: Record<string, unknown>
}

// API functions
async function fetchAgents(): Promise<Agent[]> {
  const response = await fetch('/api/agents')
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch agents' }))
    throw new Error(error.error || 'Failed to fetch agents')
  }
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

async function fetchAgent(id: string): Promise<Agent> {
  const response = await fetch(`/api/agents/${id}`)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch agent' }))
    throw new Error(error.error || 'Failed to fetch agent')
  }
  return await response.json()
}

async function createAgent(input: CreateAgentInput): Promise<Agent> {
  const response = await fetch('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create agent' }))
    throw new Error(error.error || 'Failed to create agent')
  }
  return await response.json()
}

async function updateAgent(id: string, input: UpdateAgentInput): Promise<Agent> {
  const response = await fetch(`/api/agents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update agent' }))
    throw new Error(error.error || 'Failed to update agent')
  }
  return await response.json()
}

async function deleteAgent(id: string): Promise<void> {
  const response = await fetch(`/api/agents/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete agent')
  }
}

// React Query hooks
export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  })
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: () => fetchAgent(id),
    enabled: !!id,
  })
}

export function useCreateAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAgent,
    // Optimistic update: add agent immediately to the list
    onMutate: async (newAgent) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['agents'] })

      // Snapshot the previous value
      const previousAgents = queryClient.getQueryData<Agent[]>(['agents'])

      // Optimistically update the cache with a temporary agent
      const optimisticAgent: Agent = {
        id: `temp-${Date.now()}`,
        company_id: '',
        name: newAgent.name,
        description: newAgent.description || null,
        system_prompt: newAgent.system_prompt,
        model: newAgent.model || 'gpt-4-turbo',
        temperature: newAgent.temperature || 0.7,
        max_tokens: newAgent.max_tokens || 2000,
        enabled: newAgent.enabled ?? true,
        voice_settings: newAgent.voice_settings || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      queryClient.setQueryData<Agent[]>(['agents'], (old = []) => [
        optimisticAgent,
        ...old,
      ])

      // Return context with snapshot for rollback
      return { previousAgents }
    },
    onError: (error: Error, _newAgent, context) => {
      // Rollback on error
      if (context?.previousAgents) {
        queryClient.setQueryData(['agents'], context.previousAgents)
      }
      toast.error(error.message || 'Failed to create agent')
    },
    onSuccess: (data) => {
      // Replace optimistic agent with real data
      queryClient.setQueryData<Agent[]>(['agents'], (old = []) => {
        const filtered = old.filter((agent) => !agent.id.startsWith('temp-'))
        return [data, ...filtered]
      })
      toast.success('Agent created successfully')
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

export function useUpdateAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAgentInput }) =>
      updateAgent(id, data),
    // Optimistic update: update agent immediately in the list and individual query
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['agents'] })
      await queryClient.cancelQueries({ queryKey: ['agents', id] })

      // Snapshot previous values
      const previousAgents = queryClient.getQueryData<Agent[]>(['agents'])
      const previousAgent = queryClient.getQueryData<Agent>(['agents', id])

      // Optimistically update the agents list
      queryClient.setQueryData<Agent[]>(['agents'], (old = []) =>
        old.map((agent) =>
          agent.id === id
            ? { ...agent, ...data, updated_at: new Date().toISOString() }
            : agent
        )
      )

      // Optimistically update the individual agent query
      if (previousAgent) {
        queryClient.setQueryData<Agent>(['agents', id], (old) => ({
          ...old!,
          ...data,
          updated_at: new Date().toISOString(),
        }))
      }

      // Return context for rollback
      return { previousAgents, previousAgent }
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousAgents) {
        queryClient.setQueryData(['agents'], context.previousAgents)
      }
      if (context?.previousAgent) {
        queryClient.setQueryData(['agents', variables.id], context.previousAgent)
      }
      toast.error(error.message || 'Failed to update agent')
    },
    onSuccess: (data, variables) => {
      // Update with real data from server
      queryClient.setQueryData<Agent[]>(['agents'], (old = []) =>
        old.map((agent) => (agent.id === variables.id ? data : agent))
      )
      queryClient.setQueryData(['agents', variables.id], data)
      toast.success('Agent updated successfully')
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      queryClient.invalidateQueries({ queryKey: ['agents', variables.id] })
    },
  })
}

export function useDeleteAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteAgent,
    // Optimistic update: remove agent immediately from the list
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['agents'] })
      await queryClient.cancelQueries({ queryKey: ['agents', id] })

      // Snapshot previous values
      const previousAgents = queryClient.getQueryData<Agent[]>(['agents'])
      const previousAgent = queryClient.getQueryData<Agent>(['agents', id])

      // Optimistically remove from list
      queryClient.setQueryData<Agent[]>(['agents'], (old = []) =>
        old.filter((agent) => agent.id !== id)
      )

      // Remove individual query
      queryClient.removeQueries({ queryKey: ['agents', id] })

      // Return context for rollback
      return { previousAgents, previousAgent }
    },
    onError: (error: Error, id, context) => {
      // Rollback on error
      if (context?.previousAgents) {
        queryClient.setQueryData(['agents'], context.previousAgents)
      }
      if (context?.previousAgent) {
        queryClient.setQueryData(['agents', id], context.previousAgent)
      }
      toast.error(error.message || 'Failed to delete agent')
    },
    onSuccess: () => {
      toast.success('Agent deleted successfully')
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

