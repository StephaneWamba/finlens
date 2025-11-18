/**
 * Agent Schema
 * Shared validation schema for agent creation and updates
 */

import { z } from 'zod'
import { AGENT_DEFAULTS, PERSONALITY_TONES, COMMUNICATION_STYLES, VALIDATION_LIMITS } from '@/lib/constants'

export const agentSchema = z.object({
  name: z
    .string()
    .min(VALIDATION_LIMITS.NAME_MIN, 'Name is required')
    .max(VALIDATION_LIMITS.NAME_MAX, 'Name too long'),
  description: z
    .string()
    .max(VALIDATION_LIMITS.DESCRIPTION_MAX, 'Description too long')
    .optional(),
  system_prompt: z
    .string()
    .min(VALIDATION_LIMITS.SYSTEM_PROMPT_MIN, 'System prompt must be at least 10 characters')
    .max(VALIDATION_LIMITS.SYSTEM_PROMPT_MAX, 'System prompt too long'),
  personality_tone: z.enum(['professional', 'friendly', 'casual', 'formal', 'enthusiastic']),
  communication_style: z.enum(['concise', 'detailed', 'balanced']),
  voice: z.string().optional(),
  language: z.string(),
  speed: z
    .number()
    .min(VALIDATION_LIMITS.SPEED_MIN)
    .max(VALIDATION_LIMITS.SPEED_MAX),
  pitch: z
    .number()
    .min(VALIDATION_LIMITS.PITCH_MIN)
    .max(VALIDATION_LIMITS.PITCH_MAX),
  video_enabled: z.boolean(),
  model: z.string(),
  temperature: z
    .number()
    .min(VALIDATION_LIMITS.TEMPERATURE_MIN)
    .max(VALIDATION_LIMITS.TEMPERATURE_MAX),
  max_tokens: z
    .number()
    .int()
    .min(VALIDATION_LIMITS.TOKENS_MIN)
    .max(VALIDATION_LIMITS.TOKENS_MAX),
  enabled: z.boolean(),
})

export type AgentFormValues = z.infer<typeof agentSchema>