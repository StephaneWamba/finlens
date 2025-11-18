/**
 * Configuration Constants
 * Application-wide configuration values
 */

// AI Model Configuration
export const AI_MODELS = {
  DEFAULT: 'gpt-4o-mini',
  TURBO: 'gpt-4-turbo-preview',
  GPT4: 'gpt-4',
  GPT4O_MINI: 'gpt-4o-mini',
} as const

// Agent Defaults
export const AGENT_DEFAULTS = {
  PERSONALITY_TONE: 'professional' as const,
  COMMUNICATION_STYLE: 'balanced' as const,
  LANGUAGE: 'en-US',
  VOICE: 'alloy',
  SPEED: 1.0,
  PITCH: 1.0,
  TEMPERATURE: 0.7,
  MAX_TOKENS: 800,
  MODEL: 'gpt-4o-mini',
  VIDEO_ENABLED: false,
  ENABLED: true,
} as const

// Personality Tones
export const PERSONALITY_TONES = ['professional', 'friendly', 'casual', 'formal', 'enthusiastic'] as const

// Communication Styles
export const COMMUNICATION_STYLES = ['concise', 'detailed', 'balanced'] as const

// Voice Options
export const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy (Neutral)' },
  { value: 'echo', label: 'Echo (Male)' },
  { value: 'fable', label: 'Fable (British)' },
  { value: 'onyx', label: 'Onyx (Deep Male)' },
  { value: 'nova', label: 'Nova (Female)' },
  { value: 'shimmer', label: 'Shimmer (Soft Female)' },
] as const

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ACCEPTED_TYPES: [
    'image/*',
    'application/pdf',
    '.doc',
    '.docx',
    '.txt',
    '.md',
    '.csv',
    '.xls',
    '.xlsx',
  ],
} as const

// Knowledge Base
export const KNOWLEDGE_BASE = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  PROCESSING_TIMEOUT: 300000, // 5 minutes
  CHUNK_SIZE: 1000,
  TOP_K_RESULTS: 5,
} as const
