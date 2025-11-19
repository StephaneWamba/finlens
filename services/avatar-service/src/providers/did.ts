/**
 * D-ID Avatar Provider
 * Integrates with D-ID Creative Reality Studio API
 */

import { BaseAvatarProvider } from './base.js'
import type { AvatarProviderConfig, AvatarStreamConfig } from '../types/index.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { Readable, PassThrough } from 'stream'

const logger = createLogger('avatar-service:provider:did')

export class DIDAvatarProvider extends BaseAvatarProvider {
  private apiKey: string = ''
  private apiUrl: string = 'https://api.d-id.com'

  constructor() {
    super('did')
  }

  async initialize(config: AvatarProviderConfig): Promise<void> {
    this.config = config
    this.validateConfig(['apiKey'])
    this.apiKey = config.apiKey as string
    this.apiUrl = config.apiUrl || 'https://api.d-id.com'
    this.isInitialized = true
    logger.info('D-ID provider initialized')
  }

  async startStream(
    audioStream: NodeJS.ReadableStream,
    config: AvatarStreamConfig
  ): Promise<NodeJS.ReadableStream> {
    if (!this.isInitialized) {
      throw new Error('D-ID provider not initialized')
    }

    logger.info('Starting D-ID avatar stream', {
      conversationId: config.conversationId,
      agentId: config.agentId,
    })

    // Create a pass-through stream for video output
    const videoStream = new PassThrough()

    try {
      // Step 1: Create a streaming session with D-ID
      const sessionResponse = await fetch(`${this.apiUrl}/talks/streams`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_url: config.avatarImageUrl || 'https://d-id-public-bucket.s3.amazonaws.com/alice.jpg',
          config: {
            result_format: 'mp4',
            fluent: true,
            pad_audio: 0.0,
          },
        }),
      })

      if (!sessionResponse.ok) {
        const error = await sessionResponse.text()
        throw new Error(`D-ID API error: ${error}`)
      }

      const sessionData = await sessionResponse.json() as { id: string; session_id: string }
      const sessionId = sessionData.id || sessionData.session_id

      logger.info('D-ID session created', { sessionId })

      // Step 2: Connect to D-ID WebSocket stream
      const wsUrl = `wss://api.d-id.com/talks/streams/${sessionId}`
      const ws = new (await import('ws')).default(wsUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
        },
      })

      // Step 3: Pipe audio to D-ID and video from D-ID
      ws.on('message', (data: Buffer) => {
        // D-ID sends video chunks
        videoStream.push(data)
      })

      ws.on('error', (error: Error) => {
        logger.error('D-ID WebSocket error', { error })
        videoStream.destroy(error)
      })

      ws.on('close', () => {
        logger.info('D-ID WebSocket closed')
        videoStream.end()
      })

      // Step 4: Stream audio to D-ID
      audioStream.on('data', (chunk: Buffer) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(chunk)
        }
      })

      audioStream.on('end', () => {
        logger.info('Audio stream ended, closing D-ID connection')
        ws.close()
      })

      audioStream.on('error', (error: Error) => {
        logger.error('Audio stream error', { error })
        ws.close()
        videoStream.destroy(error)
      })

      // Store session ID for cleanup
      ;(videoStream as any).sessionId = sessionId

      return videoStream
    } catch (error) {
      logger.error('Failed to start D-ID stream', { error })
      videoStream.destroy(error as Error)
      throw error
    }
  }

  async stopStream(streamId: string): Promise<void> {
    logger.info('Stopping D-ID stream', { streamId })
    // D-ID streams are closed via WebSocket, no explicit stop endpoint needed
  }
}

