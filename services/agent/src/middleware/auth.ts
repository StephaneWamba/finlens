/**
 * Authentication Middleware
 * Verifies Supabase JWT tokens and extracts user/company info
 */

import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/database.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service')

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    company_id: string | null
  }
}

/**
 * Middleware to verify Supabase JWT token and extract user info
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      logger.warn('Authentication failed', { error: authError?.message })
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Get user's company_id from public.users table
    // Use maybeSingle() instead of single() to handle cases where user doesn't exist in users table yet
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      logger.warn('Failed to fetch user profile', { error: profileError.message })
      // Continue anyway - company_id might be null for new users
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email || '',
      company_id: userProfile?.company_id || null,
    }

    next()
  } catch (error) {
    logger.error('Authentication middleware error', { error })
    return res.status(500).json({ error: 'Authentication error' })
  }
}

/**
 * Middleware to ensure user has a company_id
 * Auto-creates a company if user doesn't have one
 */
export async function requireCompany(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  // If user already has a company_id, proceed
  if (req.user.company_id) {
    return next()
  }

  // Auto-create a company for the user
  try {
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: `${req.user.email.split('@')[0]}'s Company`,
        owner_id: req.user.id,
        subscription_tier: 'starter',
      })
      .select('id')
      .single()

    if (companyError || !company) {
      logger.error('Failed to create company', { error: companyError })
      return res.status(500).json({ 
        error: 'Failed to create company. Please contact support.' 
      })
    }

    // Update user with company_id
    const { error: updateError } = await supabase
      .from('users')
      .upsert({
        id: req.user.id,
        email: req.user.email,
        company_id: company.id,
      })

    if (updateError) {
      logger.error('Failed to update user with company_id', { error: updateError })
      return res.status(500).json({ 
        error: 'Failed to associate user with company' 
      })
    }

    // Update req.user with the new company_id
    req.user.company_id = company.id
    logger.info('Auto-created company for user', { userId: req.user.id, companyId: company.id })

    next()
  } catch (error) {
    logger.error('Error in requireCompany middleware', { error })
    return res.status(500).json({ error: 'Internal server error' })
  }
}

