/**
 * Call Recordings Routes
 * API endpoints for managing call recordings and history
 */

import express from 'express'
import { z } from 'zod'
import { authenticate, requireCompany, type AuthenticatedRequest } from '../middleware/auth.js'
import { badRequest, handleError } from '../utils/errors.js'
import { createClient } from '@supabase/supabase-js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:call-recordings')
const router = express.Router()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CreateRecordingSchema = z.object({
  conversationId: z.string().min(1),
  agentId: z.string().uuid().optional(),
  roomName: z.string().min(1),
  roomId: z.string().optional(),
  startedAt: z.string().datetime(),
})

const UpdateRecordingSchema = z.object({
  endedAt: z.string().datetime().optional(),
  durationSeconds: z.number().int().min(0).optional(),
  recordingUrl: z.string().url().optional(),
  recordingStoragePath: z.string().optional(),
  fileSizeBytes: z.number().int().min(0).optional(),
  participants: z.array(z.string()).optional(),
  status: z.enum(['recording', 'completed', 'failed', 'processing']).optional(),
})

/**
 * POST /api/call-recordings
 * Create a new call recording entry
 */
router.post(
  '/',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const validationResult = CreateRecordingSchema.safeParse(req.body)
      if (!validationResult.success) {
        return badRequest(res, validationResult.error.issues[0].message)
      }

      const { conversationId, agentId, roomName, roomId, startedAt } = validationResult.data
      const userId = req.user!.id
      const companyId = req.user!.company_id!

      const { data: recording, error } = await supabase
        .from('call_recordings')
        .insert({
          company_id: companyId,
          conversation_id: conversationId,
          agent_id: agentId,
          user_id: userId,
          room_name: roomName,
          room_id: roomId,
          started_at: startedAt,
          status: 'recording',
        })
        .select()
        .single()

      if (error) {
        logger.error('Failed to create call recording', { error, conversationId })
        throw new Error('Failed to create call recording')
      }

      // Also create call history entry
      await supabase.from('call_history').insert({
        company_id: companyId,
        conversation_id: conversationId,
        agent_id: agentId,
        user_id: userId,
        room_name: roomName,
        call_type: 'voice',
        started_at: startedAt,
        status: 'completed',
        has_recording: true,
        recording_id: recording.id,
      })

      logger.info('Call recording created', {
        recordingId: recording.id,
        conversationId,
        companyId,
      })

      res.json({
        success: true,
        recording,
      })
    } catch (error) {
      logger.error('Failed to create call recording', { error })
      handleError(error, res)
    }
  }
)

/**
 * PATCH /api/call-recordings/:id
 * Update a call recording
 */
router.patch(
  '/:id',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const validationResult = UpdateRecordingSchema.safeParse(req.body)
      if (!validationResult.success) {
        return badRequest(res, validationResult.error.issues[0].message)
      }

      const companyId = req.user!.company_id!

      // Verify recording belongs to company
      const { data: existing } = await supabase
        .from('call_recordings')
        .select('id, company_id')
        .eq('id', id)
        .eq('company_id', companyId)
        .single()

      if (!existing) {
        return res.status(404).json({ error: 'Recording not found' })
      }

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }

      // Map camelCase to snake_case
      if (validationResult.data.endedAt !== undefined) {
        updateData.ended_at = validationResult.data.endedAt
      }
      if (validationResult.data.durationSeconds !== undefined) {
        updateData.duration_seconds = validationResult.data.durationSeconds
      }
      if (validationResult.data.recordingUrl !== undefined) {
        updateData.recording_url = validationResult.data.recordingUrl
      }
      if (validationResult.data.recordingStoragePath !== undefined) {
        updateData.recording_storage_path = validationResult.data.recordingStoragePath
      }
      if (validationResult.data.fileSizeBytes !== undefined) {
        updateData.file_size_bytes = validationResult.data.fileSizeBytes
      }
      if (validationResult.data.participants !== undefined) {
        updateData.participants = validationResult.data.participants
      }
      if (validationResult.data.status !== undefined) {
        updateData.status = validationResult.data.status
      }

      const { data: recording, error } = await supabase
        .from('call_recordings')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        logger.error('Failed to update call recording', { error, id, updateData })
        return res.status(500).json({ 
          error: error.message || 'Failed to update call recording',
          details: error 
        })
      }

      // Update call history if recording is completed
      if (validationResult.data.status === 'completed' && recording) {
        await supabase
          .from('call_history')
          .update({
            ended_at: recording.ended_at,
            duration_seconds: recording.duration_seconds,
            has_recording: true,
            updated_at: new Date().toISOString(),
          })
          .eq('recording_id', id)
      }

      res.json({
        success: true,
        recording,
      })
    } catch (error) {
      logger.error('Failed to update call recording', { error })
      handleError(error, res)
    }
  }
)

/**
 * GET /api/call-recordings
 * Get call recordings for a conversation or company
 */
router.get(
  '/',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const companyId = req.user!.company_id!
      const conversationId = req.query.conversationId as string | undefined

      let query = supabase
        .from('call_recordings')
        .select('*')
        .eq('company_id', companyId)
        .order('started_at', { ascending: false })

      if (conversationId) {
        query = query.eq('conversation_id', conversationId)
      }

      const { data: recordings, error } = await query

      if (error) {
        logger.error('Failed to fetch call recordings', { error })
        throw new Error('Failed to fetch call recordings')
      }

      res.json({
        success: true,
        recordings: recordings || [],
      })
    } catch (error) {
      logger.error('Failed to fetch call recordings', { error })
      handleError(error, res)
    }
  }
)

/**
 * GET /api/call-recordings/history
 * Get call history
 * NOTE: This must come BEFORE /:id route to avoid route conflicts
 */
router.get(
  '/history',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const companyId = req.user!.company_id!
      const conversationId = req.query.conversationId as string | undefined
      const contactId = req.query.contactId as string | undefined
      const limit = parseInt(req.query.limit as string) || 50
      const offset = parseInt(req.query.offset as string) || 0

      let query = supabase
        .from('call_history')
        .select('*')
        .eq('company_id', companyId)
        .order('started_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (conversationId) {
        query = query.eq('conversation_id', conversationId)
      }

      if (contactId) {
        query = query.eq('contact_id', contactId)
      }

      const { data: history, error } = await query

      if (error) {
        logger.error('Failed to fetch call history', { error })
        throw new Error('Failed to fetch call history')
      }

      res.json({
        success: true,
        history: history || [],
        pagination: {
          limit,
          offset,
          hasMore: (history?.length || 0) === limit,
        },
      })
    } catch (error) {
      logger.error('Failed to fetch call history', { error })
      handleError(error, res)
    }
  }
)

/**
 * GET /api/call-recordings/:id
 * Get a specific call recording
 */
router.get(
  '/:id',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params
      const companyId = req.user!.company_id!

      const { data: recording, error } = await supabase
        .from('call_recordings')
        .select('*')
        .eq('id', id)
        .eq('company_id', companyId)
        .single()

      if (error || !recording) {
        return res.status(404).json({ error: 'Recording not found' })
      }

      // Regenerate signed URL if we have a storage path (ensures URL is always valid)
      if (recording.recording_storage_path) {
        try {
          logger.info('Regenerating signed URL', { 
            path: recording.recording_storage_path,
            recordingId: id,
            mimeType: recording.mime_type
          })
          
          // Generate signed URL - Supabase will return an error if file doesn't exist
          const { data: signedUrlData, error: urlError } = await supabase.storage
            .from('recordings')
            .createSignedUrl(recording.recording_storage_path, 3600) // 1 hour validity

          if (!urlError && signedUrlData?.signedUrl) {
            recording.recording_url = signedUrlData.signedUrl
            logger.info('Successfully regenerated signed URL', { 
              path: recording.recording_storage_path,
              urlLength: signedUrlData.signedUrl.length,
              mimeType: recording.mime_type
            })
          } else {
            // Check if it's a "file not found" error
            const isNotFound = urlError?.message?.includes('not found') || 
                              urlError?.message?.includes('No such file') ||
                              urlError?.statusCode === '404'
            
            logger.error('Failed to regenerate signed URL', { 
              error: urlError, 
              errorMessage: urlError?.message,
              statusCode: urlError?.statusCode,
              path: recording.recording_storage_path,
              recordingId: id,
              isNotFound,
              hasExistingUrl: !!recording.recording_url
            })
            
            // If file not found, set URL to null
            if (isNotFound) {
              recording.recording_url = null
            } else if (!recording.recording_url) {
              // For other errors, try to use existing URL if available
              recording.recording_url = null
            }
          }
        } catch (urlError) {
          logger.error('Exception regenerating signed URL', { 
            error: urlError instanceof Error ? urlError.message : urlError,
            path: recording.recording_storage_path,
            recordingId: id
          })
          // Continue without regenerating URL - use existing one if available
          if (!recording.recording_url) {
            recording.recording_url = null
          }
        }
      } else if (!recording.recording_url) {
        logger.warn('No storage path and no existing URL', { recordingId: id })
        recording.recording_url = null
      }

      res.json({
        success: true,
        recording,
      })
    } catch (error) {
      logger.error('Failed to fetch call recording', { error })
      handleError(error, res)
    }
  }
)

export default router

