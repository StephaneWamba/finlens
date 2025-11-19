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
import { WebhookReceiver } from 'livekit-server-sdk'

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
            const errorMessage = urlError?.message || String(urlError)
            const isNotFound = errorMessage.includes('not found') || 
                              errorMessage.includes('No such file') ||
                              errorMessage.includes('404')
            
            logger.error('Failed to regenerate signed URL', { 
              error: urlError, 
              errorMessage,
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

/**
 * POST /api/call-recordings/start-egress
 * Start LiveKit Egress recording for a room
 */
router.post(
  '/start-egress',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { recordingId, roomName } = req.body

      if (!recordingId || !roomName) {
        return badRequest(res, 'recordingId and roomName are required')
      }

      const companyId = req.user!.company_id!

      // Get recording to verify it exists and belongs to company
      const { data: recording, error: recError } = await supabase
        .from('call_recordings')
        .select('id, company_id, metadata')
        .eq('id', recordingId)
        .eq('company_id', companyId)
        .single()

      if (recError || !recording) {
        return res.status(404).json({ error: 'Recording not found' })
      }

      // Import egress service dynamically to avoid circular dependencies
      const { startRoomCompositeEgress } = await import('../services/egress.js')
      
      try {
        const egressId = await startRoomCompositeEgress(roomName, recordingId, companyId)

        // Store egress_id in recording metadata
        const currentMetadata = ((recording as any).metadata as any) || {}
        await supabase
          .from('call_recordings')
          .update({
            metadata: { ...currentMetadata, egress_id: egressId },
            status: 'recording',
          })
          .eq('id', recordingId)

        res.json({
          success: true,
          egressId,
        })
      } catch (egressError) {
        // Safely extract error message without accessing properties that might throw
        let errorMessage = 'Unknown error'
        try {
          if (egressError instanceof Error) {
            errorMessage = egressError.message || 'Error without message'
          } else {
            errorMessage = String(egressError)
          }
        } catch (stringError) {
          errorMessage = 'Failed to extract error message'
          logger.warn('Failed to convert error to string', { 
            stringError: stringError instanceof Error ? stringError.message : String(stringError)
          })
        }
        
        // Log the error safely
        try {
          logger.error('Failed to start egress', { 
            error: errorMessage,
            errorType: egressError instanceof Error ? egressError.constructor.name : typeof egressError,
            roomName,
            recordingId,
            stack: egressError instanceof Error ? egressError.stack : undefined
          })
        } catch (logError) {
          // If logging fails, at least log something
          console.error('Failed to start egress and logging failed:', logError)
        }
        
        // Provide user-friendly error messages
        if (errorMessage.includes('LiveKit configuration is missing')) {
          return res.status(500).json({ 
            error: 'LiveKit configuration is missing. Please check LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET environment variables.' 
          })
        }
        
        if (errorMessage.includes('room') || errorMessage.includes('Room') || errorMessage.includes('not found')) {
          return res.status(400).json({ 
            error: `Failed to start recording for room "${roomName}": ${errorMessage}` 
          })
        }
        
        // Return generic error to avoid exposing internal details
        return res.status(500).json({ 
          error: `Failed to start egress: ${errorMessage}` 
        })
      }
    } catch (error) {
      logger.error('Failed to start egress (outer catch)', { error })
      handleError(error, res)
    }
  }
)

/**
 * POST /api/call-recordings/stop-egress
 * Stop LiveKit Egress recording
 */
router.post(
  '/stop-egress',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { egressId, recordingId } = req.body

      if (!egressId) {
        return badRequest(res, 'egressId is required')
      }

      const companyId = req.user!.company_id!

      // Verify recording belongs to company if provided
      if (recordingId) {
        const { data: recording, error: recError } = await supabase
          .from('call_recordings')
          .select('id, company_id')
          .eq('id', recordingId)
          .eq('company_id', companyId)
          .single()

        if (recError || !recording) {
          return res.status(404).json({ error: 'Recording not found' })
        }
      }

      // Import egress service dynamically
      const { stopEgress } = await import('../services/egress.js')
      
      await stopEgress(egressId)

      res.json({
        success: true,
        message: 'Egress stopped',
      })
    } catch (error) {
      logger.error('Failed to stop egress', { error })
      handleError(error, res)
    }
  }
)

/**
 * POST /api/call-recordings/egress-webhook
 * Handle LiveKit Egress webhook events
 * This endpoint should be configured in LiveKit webhook settings
 * LiveKit signs the webhook with JWT in Authorization header
 * 
 * Note: This route must use express.raw() middleware to receive raw body
 * for signature verification. See index.ts for middleware setup.
 */
router.post(
  '/egress-webhook',
  // Use raw body parser for webhook signature verification
  express.raw({ type: 'application/webhook+json' }),
  async (req, res) => {
    try {
      // Verify webhook signature from LiveKit using WebhookReceiver
      const apiKey = process.env.LIVEKIT_API_KEY
      const apiSecret = process.env.LIVEKIT_API_SECRET

      if (!apiKey || !apiSecret) {
        logger.error('LiveKit API credentials not configured for webhook verification')
        return res.status(500).json({ error: 'Webhook verification not configured' })
      }

      const receiver = new WebhookReceiver(apiKey, apiSecret)
      const authHeader = req.get('Authorization')

      if (!authHeader) {
        logger.warn('Webhook received without Authorization header')
        return res.status(401).json({ error: 'Missing authorization' })
      }

      // Verify signature and decode event
      // req.body is a Buffer when using express.raw()
      let event
      try {
        event = await receiver.receive(req.body, authHeader)
      } catch (verifyError) {
        logger.error('Webhook signature verification failed', {
          error: verifyError instanceof Error ? verifyError.message : String(verifyError),
        })
        return res.status(401).json({ error: 'Invalid webhook signature' })
      }

      logger.info('Egress webhook received', {
        event: event.event,
        egressId: (event as any).egressInfo?.egressId || (event as any).egress?.egressId,
      })

      // Handle egress completion - webhook uses 'egressInfo' field
      const egressInfo = (event as any).egressInfo
      if (event.event === 'egress_ended' && egressInfo) {
        const egress = egressInfo as any
        const egressId = egress.egressId

        // Find recording by egress_id in metadata
        const { data: recordings, error: findError } = await supabase
          .from('call_recordings')
          .select('id, company_id, metadata')
          .in('status', ['recording', 'processing'])

        if (findError) {
          logger.error('Failed to find recording', { error: findError, egressId })
          return res.status(500).json({ error: 'Failed to process webhook' })
        }

        const recording = recordings?.find(
          (r) => (r as any).metadata && ((r as any).metadata as any).egress_id === egressId
        )

        if (!recording) {
          logger.warn('Recording not found for egress', { egressId })
          return res.status(404).json({ error: 'Recording not found' })
        }

        // Check if file is available and egress completed successfully
        const egressFile = egress.file as any
        const egressStatus = egress.status as string
        if (egressFile && egressFile.filename && egressStatus === 'EGRESS_COMPLETE') {
          try {
            // File path should match what was configured in Egress request
            // If S3Upload was configured, file is already in Supabase Storage
            // Otherwise, we need to download from LiveKit and upload to Supabase
            const filePath = egressFile.filename || `${(recording as any).company_id}/recordings/${(recording as any).id}.mp4`
            
            logger.info('Processing completed egress file', {
              recordingId: (recording as any).id,
              filename: egressFile.filename,
              filePath,
              size: egressFile.size,
            })

            // Check if file already exists in Supabase Storage (if S3Upload was configured)
            const fileDir = filePath.split('/').slice(0, -1).join('/')
            const fileName = filePath.split('/').pop()
            const { data: existingFiles } = await supabase.storage
              .from('recordings')
              .list(fileDir || '', {
                search: fileName,
              })

            let recordingUrl: string | null = null
            let finalFilePath = filePath

            if (existingFiles && existingFiles.length > 0) {
              // File was uploaded directly via S3Upload
              logger.info('File found in Supabase Storage (uploaded via S3)', {
                recordingId: (recording as any).id,
                filePath,
              })
              finalFilePath = filePath
            } else {
              // File is on LiveKit server, need to download and upload
              // This would require LiveKit's file download API
              logger.warn('File not found in Supabase Storage, may need manual download', {
                recordingId: (recording as any).id,
                filePath,
                egressId,
              })
              // For now, we'll store the path and handle download separately
              // In production, implement file download from LiveKit
            }

            // Generate signed URL for the file
            const { data: signedUrlData, error: urlError } = await supabase.storage
              .from('recordings')
              .createSignedUrl(finalFilePath, 31536000) // 1 year validity

            if (urlError && !signedUrlData) {
              logger.warn('Failed to generate signed URL, file may not exist yet', {
                error: urlError,
                filePath: finalFilePath,
              })
            } else {
              recordingUrl = signedUrlData?.signedUrl || null
            }

            await supabase
              .from('call_recordings')
              .update({
                status: 'completed',
                recording_storage_path: finalFilePath,
                recording_url: recordingUrl,
                file_size_bytes: egressFile.size || null,
                mime_type: 'audio/mp4',
                metadata: {
                  ...((recording as any).metadata || {}),
                  egress_file: egressFile.filename,
                  egress_status: egressStatus,
                  egress_started_at: (egress as any).startedAt,
                  egress_ended_at: (egress as any).endedAt,
                },
              })
              .eq('id', (recording as any).id)

            logger.info('Recording updated with file info', {
              recordingId: (recording as any).id,
              filePath: finalFilePath,
              hasUrl: !!recordingUrl,
              fileSize: egressFile.size,
            })
            
          } catch (fileError) {
            logger.error('Failed to process file', {
              error: fileError instanceof Error ? fileError.message : String(fileError),
              recordingId: (recording as any).id,
              egressId,
            })
            
            // Mark as failed but keep metadata
            await supabase
              .from('call_recordings')
              .update({
                status: 'failed',
                metadata: {
                  ...((recording as any).metadata || {}),
                  egress_status: egressStatus,
                  egress_error: fileError instanceof Error ? fileError.message : 'File processing failed',
                },
              })
              .eq('id', (recording as any).id)
          }
        } else if (egressStatus === 'EGRESS_COMPLETE') {
          // Egress completed but no file info
          await supabase
            .from('call_recordings')
            .update({
              status: 'completed',
              metadata: {
                ...((recording as any).metadata || {}),
                egress_status: egressStatus,
              },
            })
            .eq('id', (recording as any).id)
        } else if (egressStatus === 'EGRESS_FAILED' || egressStatus === 'EGRESS_ABORTED') {
          await supabase
            .from('call_recordings')
            .update({
              status: 'failed',
              metadata: {
                ...((recording as any).metadata || {}),
                egress_status: egressStatus,
                egress_error: (egress as any).error || 'Egress failed',
              },
            })
            .eq('id', (recording as any).id)
        }
      }

      res.json({ success: true })
    } catch (error) {
      logger.error('Failed to process egress webhook', { error })
      res.status(500).json({ error: 'Failed to process webhook' })
    }
  }
)

export default router

