/**
 * Avatar Service Type Definitions
 */

export interface AvatarStreamConfig {
  conversationId: string
  agentId: string
  companyId: string
  roomName: string
  liveKitUrl: string
  liveKitToken: string
  avatarImageUrl?: string
  provider?: string
}

export interface AvatarProviderConfig {
  apiKey?: string
  apiUrl?: string
  [key: string]: unknown
}

export interface AvatarVideoFrame {
  data: Buffer
  timestamp: number
  width: number
  height: number
}

export interface AvatarProvider {
  /**
   * Initialize the provider with configuration
   */
  initialize(config: AvatarProviderConfig): Promise<void>

  /**
   * Start generating avatar video stream from audio
   */
  startStream(
    audioStream: NodeJS.ReadableStream,
    config: AvatarStreamConfig
  ): Promise<NodeJS.ReadableStream>

  /**
   * Stop the avatar stream
   */
  stopStream(streamId: string): Promise<void>

  /**
   * Get provider name
   */
  getName(): string

  /**
   * Check if provider is available/configured
   */
  isAvailable(): boolean

  /**
   * Cleanup resources
   */
  cleanup?(): Promise<void>
}

export interface LiveKitRoomConfig {
  url: string
  token: string
  roomName: string
}

