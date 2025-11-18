/**
 * UI Constants
 * UI-related constants like debounce delays, animation durations, etc.
 */

// Debounce Delays (in milliseconds)
export const DEBOUNCE_DELAYS = {
  SEARCH: 300,
  INPUT: 500,
  RESIZE: 150,
} as const

// Animation Durations (in milliseconds)
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const

// Timeouts for UI Operations (in milliseconds)
export const UI_TIMEOUTS = {
  TOAST_DURATION: 3000,
  TYPING_INDICATOR: 3000,
  READ_RECEIPT_DEBOUNCE: 3000,
  AUTO_SAVE: 2000,
} as const

// Message Limits
export const MESSAGE_LIMITS = {
  MAX_LENGTH: 10000,
  PREVIEW_LENGTH: 200,
  TRUNCATE_LENGTH: 5000,
} as const

// Validation Limits
export const VALIDATION_LIMITS = {
  NAME_MIN: 1,
  NAME_MAX: 100,
  DESCRIPTION_MAX: 500,
  SYSTEM_PROMPT_MIN: 10,
  SYSTEM_PROMPT_MAX: 10000,
  TEMPERATURE_MIN: 0,
  TEMPERATURE_MAX: 2,
  TOKENS_MIN: 100,
  TOKENS_MAX: 4000,
  SPEED_MIN: 0.5,
  SPEED_MAX: 2.0,
  PITCH_MIN: 0.5,
  PITCH_MAX: 2.0,
} as const

// Quick Reactions (Emoji)
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

