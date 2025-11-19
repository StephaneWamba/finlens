/**
 * WebSocket Client for real-time messaging
 */

import { io, type Socket } from 'socket.io-client'
import type { Message } from '../types'

export interface WebSocketClientConfig {
  url: string
  token: string
  conversationId: string
  onMessage: (message: Message) => void
  onTyping: (isTyping: boolean) => void
  onError: (error: Error) => void
}

export class WebSocketClient {
  private config: WebSocketClientConfig
  private socket: Socket | null = null
  private isConnected = false

  constructor(config: WebSocketClientConfig) {
    this.config = config
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.warn('[Syntera WebSocket] Already connected')
      return
    }

    try {
      this.socket = io(this.config.url, {
        auth: {
          token: this.config.token,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })

      // Connection events
      this.socket.on('connect', () => {
        console.log('[Syntera WebSocket] Connected')
        this.isConnected = true
        this.joinConversation()
      })

      this.socket.on('disconnect', () => {
        console.log('[Syntera WebSocket] Disconnected')
        this.isConnected = false
      })

      this.socket.on('connect_error', (error: Error) => {
        // Only log if not a reconnection attempt (Socket.io handles reconnection automatically)
        if (!this.socket?.active) {
          console.warn('[Syntera WebSocket] Connection error (will retry):', error.message)
        }
        // Don't call onError for transient connection errors during reconnection
      })

      // Message events
      // Listen for 'message' event (emitted by Chat Service)
      this.socket.on('message', (message: Message) => {
        this.config.onMessage(message)
      })
      
      // Also listen for 'message:new' for compatibility
      this.socket.on('message:new', (data: { message: Message }) => {
        this.config.onMessage(data.message)
      })

      this.socket.on('message:typing', (data: { isTyping: boolean }) => {
        this.config.onTyping(data.isTyping)
      })

      this.socket.on('error', (error: { message: string }) => {
        // Only log non-transient errors
        if (!error.message.includes('websocket error') && !error.message.includes('transport')) {
          console.error('[Syntera WebSocket] Error:', error)
          this.config.onError(new Error(error.message))
        }
      })
    } catch (error) {
      console.error('[Syntera WebSocket] Failed to connect:', error)
      this.config.onError(error as Error)
    }
  }

  /**
   * Join conversation room
   */
  private joinConversation(): void {
    if (!this.socket || !this.isConnected) return

    this.socket.emit('conversation:join', this.config.conversationId)
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      if (this.isConnected) {
        this.socket.emit('conversation:leave', this.config.conversationId)
      }
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
    }
  }

  /**
   * Send typing indicator
   */
  sendTyping(isTyping: boolean): void {
    if (!this.socket || !this.isConnected) return

    this.socket.emit('message:typing', {
      conversationId: this.config.conversationId,
      isTyping,
    })
  }
}

