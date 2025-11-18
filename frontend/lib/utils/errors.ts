/**
 * Error Handling Utilities
 * Standardized error handling patterns across the application
 */

import { toast } from 'sonner'

export interface AppError {
  message: string
  code?: string
  details?: unknown
}

interface ErrorWithCode extends Error {
  code?: string
}

/**
 * Handle API errors consistently
 */
export function handleApiError(error: unknown, defaultMessage = 'An error occurred'): AppError {
  if (error instanceof Error) {
    const errorWithCode = error as ErrorWithCode
    return {
      message: error.message || defaultMessage,
      code: errorWithCode.code,
      details: error,
    }
  }

  if (typeof error === 'string') {
    return {
      message: error,
    }
  }

  return {
    message: defaultMessage,
    details: error,
  }
}

/**
 * Show error toast with consistent styling
 */
export function showErrorToast(error: unknown, defaultMessage = 'An error occurred'): void {
  const appError = handleApiError(error, defaultMessage)
  toast.error(appError.message)
}

/**
 * Show success toast
 */
export function showSuccessToast(message: string): void {
  toast.success(message)
}

/**
 * Log error for debugging (in development)
 */
export function logError(error: unknown, context?: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context || 'Error'}]`, error)
  }
  // In production, you might want to send to error tracking service
}
