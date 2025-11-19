/**
 * API Client for Syntera Widget
 * Handles all HTTP requests to Syntera backend
 */

import type {
  Agent,
  Conversation,
  Message,
  CreateConversationInput,
  SendMessageInput,
  LiveKitTokenResponse,
  WebSocketConfig,
} from '../types'

export class APIClient {
  private baseUrl: string
  private apiKey: string

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.apiKey = apiKey
  }

  /**
   * Get agent configuration
   */
  async getAgent(agentId: string): Promise<Agent | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/public/agents/${agentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch agent: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('[Syntera API] Failed to get agent:', error)
      return null
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const response = await fetch(`${this.baseUrl}/api/public/conversations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      throw new Error(`Failed to create conversation: ${response.statusText}`)
    }

    const data = await response.json()
    return data.conversation
  }

  /**
   * Send a message
   */
  async sendMessage(input: SendMessageInput): Promise<Message> {
    const body: Record<string, unknown> = {
      conversationId: input.conversationId,
      content: input.content,
    }

    if (input.threadId) {
      body.threadId = input.threadId
    }

    // Note: Attachments not yet supported in public API
    // if (input.attachments) {
    //   body.attachments = input.attachments
    // }

    const response = await fetch(`${this.baseUrl}/api/public/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`)
    }

    const data = await response.json()
    return data.message
  }

  /**
   * Get LiveKit token for voice/video calls
   */
  async getLiveKitToken(params: {
    conversationId: string
    agentId: string
  }): Promise<LiveKitTokenResponse> {
    const response = await fetch(`${this.baseUrl}/api/public/livekit/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      throw new Error(`Failed to get LiveKit token: ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Get WebSocket configuration
   */
  async getWebSocketConfig(conversationId: string): Promise<WebSocketConfig> {
    const response = await fetch(`${this.baseUrl}/api/public/websocket/config`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId }),
    })

    if (!response.ok) {
      throw new Error(`Failed to get WebSocket config: ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Get avatar stream URL
   */
  async getAvatarStreamUrl(conversationId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/public/avatar/stream/${conversationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get avatar stream: ${response.statusText}`)
    }

    const data = await response.json()
    return data.streamUrl
  }
}

