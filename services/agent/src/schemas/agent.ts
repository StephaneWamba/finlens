/**
 * Agent Configuration Validation Schemas
 * Using Zod for type-safe validation
 */

import { z } from 'zod'

// Voice settings schema
const VoiceSettingsSchema = z.object({
  voice: z.string().optional(),
  language: z.string().optional(),
  speed: z.number().min(0.5).max(2.0).optional(),
  pitch: z.number().min(0.5).max(2.0).optional(),
  video_enabled: z.boolean().optional(),
  screen_sharing_enabled: z.boolean().optional(),
  video_quality: z.enum(['sd', 'hd', 'full-hd']).optional(),
}).passthrough() // Allow additional fields in JSONB

// Create agent schema
export const CreateAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  system_prompt: z.string().min(10, 'System prompt must be at least 10 characters').max(10000, 'System prompt too long'),
  model: z.string().default('gpt-4o-mini'),
  temperature: z.number().min(0).max(2).default(0.7),
  max_tokens: z.number().int().min(100).max(4000).default(800),
  enabled: z.boolean().default(true),
  voice_settings: VoiceSettingsSchema.optional().default({}),
})

// Update agent schema (all fields optional)
export const UpdateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  system_prompt: z.string().min(10).max(10000).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().min(100).max(4000).optional(),
  enabled: z.boolean().optional(),
  voice_settings: VoiceSettingsSchema.optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'At least one field must be provided for update',
    path: ['update']
  }
)

// Agent response schema
export const AgentResponseSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  system_prompt: z.string(),
  model: z.string(),
  temperature: z.number(),
  max_tokens: z.number(),
  enabled: z.boolean(),
  voice_settings: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

// Type exports
export type CreateAgentInput = z.infer<typeof CreateAgentSchema>
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>
export type AgentResponse = z.infer<typeof AgentResponseSchema>


