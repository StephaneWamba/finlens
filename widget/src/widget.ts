/**
 * Main Syntera Widget Class
 */

import { ChatInterface } from './ui/chat-interface'
import { APIClient } from './api/client'
import { WebSocketClient } from './api/websocket'
import { LiveKitClient } from './api/livekit'
import type { WidgetConfig, Agent, Conversation, Message } from './types'

export class SynteraWidget {
  private config: WidgetConfig
  private chatInterface: ChatInterface | null = null
  private apiClient: APIClient
  private wsClient: WebSocketClient | null = null
  private liveKitClient: LiveKitClient | null = null
  private agent: Agent | null = null
  private conversation: Conversation | null = null
  private isInitialized = false

  constructor(config: WidgetConfig) {
    this.config = config
    this.apiClient = new APIClient(config.apiUrl, config.apiKey)
  }

  /**
   * Initialize the widget
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[Syntera] Widget already initialized')
      return
    }

    try {
      // Load agent configuration
      this.agent = await this.apiClient.getAgent(this.config.agentId)
      
      if (!this.agent) {
        throw new Error('Agent not found')
      }

      // Create chat interface
      this.chatInterface = new ChatInterface({
        agent: this.agent,
        theme: this.config.theme || 'light',
        position: this.config.position || 'bottom-right',
        onSendMessage: this.handleSendMessage.bind(this),
        onStartCall: this.handleStartCall.bind(this),
        onClose: this.handleClose.bind(this),
      })

      // Initialize chat interface
      this.chatInterface.init()

      this.isInitialized = true
      console.log('[Syntera] Widget initialized successfully')
    } catch (error) {
      console.error('[Syntera] Failed to initialize widget:', error)
      this.showError('Failed to load chat. Please refresh the page.')
    }
  }

  /**
   * Handle sending a message
   */
  private async handleSendMessage(content: string): Promise<void> {
    if (!this.chatInterface || !this.agent) return

    try {
      // Create conversation if needed
      if (!this.conversation) {
        this.conversation = await this.apiClient.createConversation({
          agentId: this.config.agentId,
          channel: 'chat',
        })
      }

      // Send message
      const message = await this.apiClient.sendMessage({
        conversationId: this.conversation.id,
        content,
        threadId: null, // Main thread for now
      })

      // Add message to UI
      this.chatInterface.addMessage(message)

      // Connect WebSocket if not connected
      if (!this.wsClient && this.conversation) {
        await this.connectWebSocket()
      }

      // Wait for agent response (handled via WebSocket)
    } catch (error) {
      console.error('[Syntera] Failed to send message:', error)
      this.chatInterface.showError('Failed to send message. Please try again.')
    }
  }

  /**
   * Handle starting a voice/video call
   */
  private async handleStartCall(type: 'voice' | 'video'): Promise<void> {
    if (!this.chatInterface || !this.agent) return

    try {
      // Create conversation if needed
      if (!this.conversation) {
        this.conversation = await this.apiClient.createConversation({
          agentId: this.config.agentId,
          channel: type,
        })
      }

      // Get LiveKit token
      const tokenData = await this.apiClient.getLiveKitToken({
        conversationId: this.conversation.id,
        agentId: this.config.agentId,
      })

      // Create LiveKit client
      this.liveKitClient = new LiveKitClient()

      // Set up callbacks
      const callbacks = {
        onParticipantConnected: (participant: any) => {
          console.log('[Syntera] Agent connected to call')
        },
        onTrackSubscribed: (track: any, participant: any) => {
          if (track.kind === 'video' && this.chatInterface?.avatarPlayer) {
            // Handle avatar video track
            this.chatInterface.avatarPlayer.startWithTrack(track, participant)
          }
        },
        onDisconnected: () => {
          console.log('[Syntera] Call disconnected')
          if (this.chatInterface?.avatarPlayer) {
            this.chatInterface.avatarPlayer.stop()
          }
          this.liveKitClient = null
        },
        onError: (error: Error) => {
          console.error('[Syntera] Call error:', error)
          this.chatInterface?.showError('Call error. Please try again.')
        },
      }

      // Connect to LiveKit room
      await this.liveKitClient.connect(tokenData.url, tokenData.token, callbacks)

      // Start Avatar Service stream
      try {
        const avatarServiceUrl = process.env.AVATAR_SERVICE_URL || 'http://localhost:4009'
        await fetch(`${avatarServiceUrl}/api/avatar/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            conversationId: this.conversation.id,
            agentId: this.config.agentId,
            companyId: '', // Will be extracted from conversation
            roomName: tokenData.roomName,
            liveKitUrl: tokenData.url,
            liveKitToken: tokenData.token,
            provider: 'did',
          }),
        })
        console.log('[Syntera] Avatar Service started')
      } catch (error) {
        console.warn('[Syntera] Failed to start Avatar Service:', error)
        // Continue with call even if avatar service fails
      }

      // Start call UI
      await this.chatInterface.startCall({
        type,
        token: tokenData.token,
        url: tokenData.url,
        conversationId: this.conversation.id,
        agentId: this.config.agentId,
        apiUrl: this.config.apiUrl,
        apiKey: this.config.apiKey,
      })

      console.log('[Syntera] Call started successfully')
    } catch (error) {
      console.error('[Syntera] Failed to start call:', error)
      this.chatInterface.showError('Failed to start call. Please try again.')
      if (this.liveKitClient) {
        await this.liveKitClient.disconnect()
        this.liveKitClient = null
      }
    }
  }

  /**
   * Connect WebSocket for real-time messages
   */
  private async connectWebSocket(): Promise<void> {
    if (!this.conversation) return

    try {
      // Get WebSocket token/URL from API
      const wsConfig = await this.apiClient.getWebSocketConfig(this.conversation.id)

      this.wsClient = new WebSocketClient({
        url: wsConfig.url,
        token: wsConfig.token,
        conversationId: this.conversation.id,
        onMessage: (message: Message) => {
          if (this.chatInterface) {
            this.chatInterface.addMessage(message)
          }
        },
        onTyping: (isTyping: boolean) => {
          if (this.chatInterface) {
            this.chatInterface.setTyping(isTyping)
          }
        },
        onError: (error: Error) => {
          // Only log persistent errors, not transient connection issues
          if (!error.message.includes('websocket error') && !error.message.includes('transport')) {
            console.error('[Syntera] WebSocket error:', error)
          }
        },
      })

      await this.wsClient.connect()
    } catch (error) {
      console.error('[Syntera] Failed to connect WebSocket:', error)
    }
  }

  /**
   * Handle closing the widget
   */
  private handleClose(): void {
    // Disconnect WebSocket
    if (this.wsClient) {
      this.wsClient.disconnect()
      this.wsClient = null
    }

    // Close chat interface
    if (this.chatInterface) {
      this.chatInterface.close()
    }
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    // Create a simple error display
    const errorDiv = document.createElement('div')
    errorDiv.className = 'syntera-error'
    errorDiv.textContent = message
    errorDiv.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `
    document.body.appendChild(errorDiv)

    // Remove after 5 seconds
    setTimeout(() => {
      errorDiv.remove()
    }, 5000)
  }

  /**
   * Public API: Open widget programmatically
   */
  open(): void {
    if (this.chatInterface) {
      this.chatInterface.open()
    }
  }

  /**
   * Public API: Close widget programmatically
   */
  close(): void {
    this.handleClose()
  }

  /**
   * Public API: Send message programmatically
   */
  async sendMessage(content: string): Promise<void> {
    await this.handleSendMessage(content)
  }
}

