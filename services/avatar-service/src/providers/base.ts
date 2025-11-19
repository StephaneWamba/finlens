/**
 * Base Avatar Provider
 * Abstract class that all avatar providers should extend
 */

import type { AvatarProvider, AvatarProviderConfig, AvatarStreamConfig } from '../types/index.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('avatar-service:provider')

export abstract class BaseAvatarProvider implements AvatarProvider {
  protected config: AvatarProviderConfig = {}
  protected name: string
  protected isInitialized = false

  constructor(name: string) {
    this.name = name
  }

  abstract initialize(config: AvatarProviderConfig): Promise<void>
  abstract startStream(
    audioStream: NodeJS.ReadableStream,
    config: AvatarStreamConfig
  ): Promise<NodeJS.ReadableStream>
  abstract stopStream(streamId: string): Promise<void>

  getName(): string {
    return this.name
  }

  isAvailable(): boolean {
    return this.isInitialized
  }

  async cleanup(): Promise<void> {
    this.isInitialized = false
    logger.info(`Provider ${this.name} cleaned up`)
  }

  protected validateConfig(requiredKeys: string[]): void {
    const missing = requiredKeys.filter(key => !this.config[key])
    if (missing.length > 0) {
      throw new Error(
        `Provider ${this.name} missing required config: ${missing.join(', ')}`
      )
    }
  }
}

