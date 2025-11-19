/**
 * Avatar Service
 * Main service that orchestrates avatar generation and LiveKit streaming
 */

import { providerRegistry, type ProviderType } from '../providers/index.js'
import { LiveKitService } from './livekit.js'
import type { AvatarStreamConfig } from '../types/index.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { Readable } from 'stream'

const logger = createLogger('avatar-service:avatar')

export class AvatarService {
  private liveKitService: LiveKitService
  private activeStreams: Map<string, { provider: any; stream: NodeJS.ReadableStream }> = new Map()

  constructor() {
    this.liveKitService = new LiveKitService()
  }

  /**
   * Start avatar stream for a conversation
   */
  async startAvatarStream(
    audioStream: NodeJS.ReadableStream,
    config: AvatarStreamConfig
  ): Promise<void> {
    const streamId = config.conversationId

    if (this.activeStreams.has(streamId)) {
      logger.warn('Stream already active for conversation', { conversationId: config.conversationId })
      await this.stopAvatarStream(streamId)
    }

    try {
      // Get provider type from config or environment
      const providerType = (config.provider || process.env.AVATAR_PROVIDER || 'did') as ProviderType

      // Get provider configuration
      const providerConfig = this.getProviderConfig(providerType)

      // Initialize and get provider
      const provider = await providerRegistry.initializeProvider(providerType, providerConfig)

      // Connect to LiveKit room
      await this.liveKitService.connectToRoom({
        url: config.liveKitUrl,
        token: config.liveKitToken,
        roomName: config.roomName,
      })

      // Start avatar stream from provider
      const videoStream = await provider.startStream(audioStream, config)

      // Store active stream
      this.activeStreams.set(streamId, {
        provider,
        stream: videoStream,
      })

      // Publish video to LiveKit
      await this.liveKitService.publishVideoTrack(videoStream)

      logger.info('Avatar stream started', {
        conversationId: config.conversationId,
        provider: providerType,
      })
    } catch (error) {
      logger.error('Failed to start avatar stream', { error, conversationId: config.conversationId })
      throw error
    }
  }

  /**
   * Stop avatar stream for a conversation
   */
  async stopAvatarStream(conversationId: string): Promise<void> {
    const stream = this.activeStreams.get(conversationId)
    if (!stream) {
      logger.warn('No active stream found', { conversationId })
      return
    }

    try {
      await stream.provider.stopStream(conversationId)
      this.activeStreams.delete(conversationId)
      await this.liveKitService.disconnect()
      logger.info('Avatar stream stopped', { conversationId })
    } catch (error) {
      logger.error('Failed to stop avatar stream', { error, conversationId })
      throw error
    }
  }

  /**
   * Get provider configuration from environment
   */
  private getProviderConfig(providerType: ProviderType): Record<string, unknown> {
    const config: Record<string, unknown> = {}

    switch (providerType) {
      case 'did':
        config.apiKey = process.env.DID_API_KEY
        config.apiUrl = process.env.DID_API_URL || 'https://api.d-id.com'
        break
      case 'custom':
        config.modelUrl = process.env.CUSTOM_MODEL_URL || 'http://localhost:8000'
        config.gpuEnabled = process.env.CUSTOM_GPU_ENABLED === 'true'
        break
    }

    return config
  }

  /**
   * Get active streams
   */
  getActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys())
  }
}

