/**
 * LiveKit Egress Service
 * Handles server-side recording using LiveKit Egress API
 */

import { EgressClient, EncodedFileOutput, EncodedOutputs, S3Upload, EncodingOptionsPreset, RoomCompositeEgressRequest } from 'livekit-server-sdk'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:egress')

let egressClient: EgressClient | null = null

/**
 * Initialize Egress client
 */
function getEgressClient(): EgressClient {
  if (!egressClient) {
    const url = process.env.LIVEKIT_URL
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET

    if (!url || !apiKey || !apiSecret) {
      throw new Error('LiveKit configuration is missing')
    }

    // Convert wss:// to https:// for Egress API
    const httpUrl = url.replace('wss://', 'https://').replace('ws://', 'http://')
    
    egressClient = new EgressClient(httpUrl, apiKey, apiSecret)
    logger.info('Egress client initialized', { url: httpUrl })
  }

  return egressClient
}

/**
 * Start audio-only room composite egress recording
 * Records the entire room's audio to a file
 */
export async function startRoomCompositeEgress(
  roomName: string,
  recordingId: string,
  companyId: string
): Promise<string> {
  try {
    const client = getEgressClient()

    const filepath = `${companyId}/recordings/${recordingId}.mp4`

    // Configure S3Upload to upload directly to Supabase Storage
    // Supabase Storage is S3-compatible
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseStorageAccessKey = process.env.SUPABASE_STORAGE_ACCESS_KEY
    const supabaseStorageSecret = process.env.SUPABASE_STORAGE_SECRET_KEY

    let fileOutput: any // Use 'any' to bypass type checking - EncodedFileOutput structure may vary by SDK version

    if (supabaseStorageAccessKey && supabaseStorageSecret && supabaseUrl) {
      // Extract project ref from Supabase URL (e.g., https://xxxxx.supabase.co -> xxxxx)
      const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '').split('.')[0]
      
      // Supabase Storage S3 endpoint
      // Note: Supabase Storage S3 endpoint format may vary
      // If this doesn't work, check Supabase docs for the correct S3 endpoint
      const s3Endpoint = `${projectRef}.supabase.co`
      
      // EncodedFileOutput structure: filepath and s3 (based on LiveKit API docs)
      fileOutput = {
        filepath,
        s3: {
          accessKey: supabaseStorageAccessKey,
          secret: supabaseStorageSecret,
          bucket: 'recordings',
          region: 'us-east-1', // Supabase typically uses us-east-1
          endpoint: `https://${s3Endpoint}`,
          forcePathStyle: true, // Required for Supabase Storage S3 compatibility
        },
      } as any
      
      logger.info('Configuring S3Upload for Supabase Storage', {
        endpoint: s3Endpoint,
        bucket: 'recordings',
        filepath,
        projectRef,
      })
    } else {
      // Fallback: file will be stored on LiveKit server and downloaded via webhook
      logger.warn('Supabase Storage S3 credentials not configured, file will be stored on LiveKit server', {
        filepath,
      })
      
      fileOutput = {
        filepath,
      } as any
    }

    // SDK expects: startRoomCompositeEgress(roomName, output, opts)
    // Pass EncodedFileOutput directly - SDK will set both fileOutputs and legacyOutput
    // Note: RoomCompositeOptions supports audioOnly/videoOnly even if not in the interface
    // EncodingOptionsPreset is a number enum (0 = H264_720P_30)
    const egressOptions = {
      audioOnly: true,
      layout: 'speaker', // Layout doesn't matter for audio-only
      encodingOptions: 0 as EncodingOptionsPreset, // H264_720P_30 = 0
    } as any // Type assertion needed because RoomCompositeOptions interface may be incomplete

    // Debug: Log the fileOutput structure
    logger.info('Starting egress with EncodedFileOutput', {
      filepath: fileOutput.filepath,
      hasS3: !!fileOutput.s3,
      s3Bucket: fileOutput.s3?.bucket,
      s3Endpoint: fileOutput.s3?.endpoint,
      s3AccessKey: fileOutput.s3?.accessKey ? '***' : undefined,
      s3Secret: fileOutput.s3?.secret ? '***' : undefined,
      s3Region: fileOutput.s3?.region,
      s3ForcePathStyle: fileOutput.s3?.forcePathStyle,
    })

    // Log the exact structure being sent
    console.log('[EGRESS] FileOutput structure:', JSON.stringify({
      filepath: fileOutput.filepath,
      hasS3: !!fileOutput.s3,
      s3Keys: fileOutput.s3 ? Object.keys(fileOutput.s3) : [],
    }, null, 2))

    let info
    try {
      // Use SDK helper - it should handle the request construction correctly
      info = await client.startRoomCompositeEgress(roomName, fileOutput, egressOptions)
      // Log immediately after successful call
      console.log('[EGRESS] LiveKit API call succeeded, response type:', typeof info, 'has egressId:', !!info?.egressId)
    } catch (egressError) {
      // Use both logger and console to ensure we see the error
      const errorMsg = egressError instanceof Error ? egressError.message : String(egressError)
      const errorStack = egressError instanceof Error ? egressError.stack : undefined
      
      console.error('[EGRESS] LiveKit Egress API call failed:', errorMsg)
      console.error('[EGRESS] Error stack:', errorStack)
      console.error('[EGRESS] FileOutput that failed:', JSON.stringify({
        filepath: fileOutput.filepath,
        hasS3: !!fileOutput.s3,
        s3Structure: fileOutput.s3 ? {
          hasAccessKey: !!fileOutput.s3.accessKey,
          hasSecret: !!fileOutput.s3.secret,
          bucket: fileOutput.s3.bucket,
          region: fileOutput.s3.region,
          endpoint: fileOutput.s3.endpoint,
          forcePathStyle: fileOutput.s3.forcePathStyle,
        } : null,
      }, null, 2))
      
      logger.error('LiveKit Egress API call failed', {
        error: errorMsg,
        stack: errorStack,
        roomName,
        recordingId,
        filepath: fileOutput.filepath,
        hasS3: !!fileOutput.s3,
      })
      throw egressError
    }
    
    // Log the response structure safely (avoid accessing .file which might throw)
    try {
      const logData: any = {
        egressId: undefined,
        status: undefined,
        responseKeys: [],
      }
      
      // Safely extract egressId
      try {
        logData.egressId = info?.egressId
      } catch (e) {
        logData.egressId = 'error accessing egressId'
      }
      
      // Safely extract status
      try {
        logData.status = info?.status
      } catch (e) {
        logData.status = 'error accessing status'
      }
      
      // Safely get keys
      try {
        if (info && typeof info === 'object') {
          logData.responseKeys = Object.keys(info)
        }
      } catch (e) {
        logData.responseKeys = ['error getting keys']
      }
      
      logger.info('LiveKit Egress response received', logData)
    } catch (logError) {
      logger.warn('Failed to log egress response', { 
        error: logError instanceof Error ? logError.message : String(logError)
      })
    }
    
    // Safely check for egressId without accessing other properties
    let egressId: string | undefined
    try {
      egressId = info?.egressId
    } catch (e) {
      logger.error('Failed to access egressId from response', {
        error: e instanceof Error ? e.message : String(e),
        roomName,
        recordingId,
      })
      throw new Error('Failed to get egressId from LiveKit response')
    }
    
    if (!egressId) {
      // Try to safely stringify for debugging (avoid accessing .file)
      let infoString = 'null/undefined'
      try {
        if (info && typeof info === 'object') {
          // Create a safe copy without accessing problematic properties
          const safeInfo: any = {}
          try {
            if ('egressId' in info) safeInfo.egressId = (info as any).egressId
            if ('status' in info) safeInfo.status = (info as any).status
            safeInfo.keys = Object.keys(info)
            infoString = JSON.stringify(safeInfo)
          } catch {
            infoString = 'object exists but could not be serialized'
          }
        }
      } catch {
        infoString = 'error accessing info object'
      }
      
      logger.error('Invalid response from LiveKit Egress: missing egressId', {
        info: infoString,
        roomName,
        recordingId,
      })
      throw new Error('Invalid response from LiveKit Egress: missing egressId')
    }
    
    // Safely extract status for logging
    let status: any = undefined
    try {
      status = info?.status
    } catch {
      status = 'error accessing status'
    }
    
    logger.info('Room composite egress started', {
      egressId,
      roomName,
      recordingId,
      status,
      hasS3Upload: !!fileOutput.s3,
    })

    return egressId
  } catch (error) {
    // Safely extract error message without accessing properties that might throw
    let errorMessage = 'Unknown error'
    let errorStack: string | undefined = undefined
    
    try {
      if (error instanceof Error) {
        errorMessage = error.message || 'Error without message'
        errorStack = error.stack
      } else {
        // Try to convert to string, but catch if it fails
        try {
          errorMessage = String(error)
        } catch {
          errorMessage = 'Error object could not be converted to string'
        }
      }
    } catch (extractError) {
      errorMessage = 'Failed to extract error message'
      logger.warn('Failed to extract error details', {
        extractError: extractError instanceof Error ? extractError.message : String(extractError)
      })
    }
    
    logger.error('Failed to start room composite egress', {
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      roomName,
      recordingId,
      stack: errorStack,
    })
    
    // Re-throw with a safe error message
    throw new Error(errorMessage)
  }
}

/**
 * Stop an active egress recording
 */
export async function stopEgress(egressId: string): Promise<void> {
  try {
    const client = getEgressClient()
    const info = await client.stopEgress(egressId)
    
    logger.info('Egress stopped', {
      egressId,
      status: info.status,
    })
  } catch (error) {
    logger.error('Failed to stop egress', {
      error: error instanceof Error ? error.message : String(error),
      egressId,
    })
    throw error
  }
}

/**
 * Get egress status
 */
export async function getEgressStatus(egressId: string) {
  try {
    const client = getEgressClient()
    const list = await client.listEgress({ roomName: '' })
    
    const egress = list.find(e => e.egressId === egressId)
    return egress || null
  } catch (error) {
    logger.error('Failed to get egress status', {
      error: error instanceof Error ? error.message : String(error),
      egressId,
    })
    return null
  }
}

