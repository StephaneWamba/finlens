/**
 * Error handling utilities
 */

import { Response } from 'express'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service')

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message)
    Error.captureStackTrace(this, this.constructor)
  }
}

export function handleError(err: unknown, res: Response) {
  if (err instanceof AppError) {
    logger.warn('Operational error', { 
      statusCode: err.statusCode, 
      message: err.message 
    })
    return res.status(err.statusCode).json({ 
      error: err.message 
    })
  }

  if (err instanceof Error) {
    logger.error('Unexpected error', { 
      error: err.message, 
      stack: err.stack 
    })
    return res.status(500).json({ 
      error: 'Internal server error' 
    })
  }

  logger.error('Unknown error', { error: err })
  return res.status(500).json({ 
    error: 'Internal server error' 
  })
}

export function notFound(res: Response, resource: string, id: string) {
  return res.status(404).json({ 
    error: `${resource} with id ${id} not found` 
  })
}

export function forbidden(res: Response, message = 'Access forbidden') {
  return res.status(403).json({ error: message })
}

export function badRequest(res: Response, message: string) {
  return res.status(400).json({ error: message })
}


