/**
 * Socket.io Authentication Middleware
 * Verifies Supabase JWT tokens for Socket.io connections
 */

import { Socket } from 'socket.io'
import { createClient } from '@supabase/supabase-js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('chat-service:auth')

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface AuthenticatedSocket extends Socket {
  userId?: string
  companyId?: string
  email?: string
  token?: string // Store the JWT token for service-to-service calls
}

/**
 * Socket.io authentication middleware
 * Verifies JWT token and attaches user info to socket
 */
export async function authenticateSocket(
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
) {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '')

    if (!token) {
      logger.warn('Socket connection rejected: No token provided', { socketId: socket.id })
      return next(new Error('Authentication required'))
    }

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      logger.warn('Socket connection rejected: Invalid token', { socketId: socket.id, error: authError?.message })
      return next(new Error('Invalid or expired token'))
    }

    // Get user's company_id from public.users table
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      logger.warn('Failed to fetch user profile', { error: profileError.message })
      // Continue anyway - company_id might be null for new users
    }

    // Attach user info to socket
    socket.userId = user.id
    socket.companyId = userProfile?.company_id || null
    socket.email = user.email || undefined
    socket.token = token // Store token for service-to-service calls

    logger.info('Socket authenticated', { 
      socketId: socket.id, 
      userId: socket.userId,
      companyId: socket.companyId 
    })

    next()
  } catch (error) {
    logger.error('Socket authentication error', { error, socketId: socket.id })
    next(new Error('Authentication error'))
  }
}

