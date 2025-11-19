/**
 * Avatar Provider Registry
 * Manages available providers and allows easy switching
 */

import { DIDAvatarProvider } from './did.js'
import { CustomAvatarProvider } from './custom.js'
import type { AvatarProvider } from '../types/index.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('avatar-service:providers')

export type ProviderType = 'did' | 'custom'

class ProviderRegistry {
  private providers: Map<string, AvatarProvider> = new Map()

  constructor() {
    // Register available providers
    this.register('did', new DIDAvatarProvider())
    this.register('custom', new CustomAvatarProvider())
  }

  register(name: string, provider: AvatarProvider): void {
    this.providers.set(name, provider)
    logger.info(`Registered avatar provider: ${name}`)
  }

  get(name: ProviderType): AvatarProvider | undefined {
    return this.providers.get(name)
  }

  getAvailable(): string[] {
    return Array.from(this.providers.keys())
  }

  async initializeProvider(
    type: ProviderType,
    config: Record<string, unknown>
  ): Promise<AvatarProvider> {
    const provider = this.get(type)
    if (!provider) {
      throw new Error(`Provider ${type} not found. Available: ${this.getAvailable().join(', ')}`)
    }

    await provider.initialize(config)
    return provider
  }
}

export const providerRegistry = new ProviderRegistry()

