/**
 * Avatar Player Component
 * Handles avatar video streaming and display from LiveKit
 */

import { Track, RemoteParticipant } from 'livekit-client'

export interface AvatarPlayerConfig {
  container: HTMLElement
  conversationId: string
  apiUrl: string
  apiKey: string
}

export class AvatarPlayer {
  private config: AvatarPlayerConfig
  private videoElement: HTMLVideoElement | null = null
  private container: HTMLDivElement | null = null
  private isPlaying = false
  private currentTrack: Track | null = null

  constructor(config: AvatarPlayerConfig) {
    this.config = config
  }

  /**
   * Start avatar stream from LiveKit track
   */
  async startWithTrack(track: Track, participant: RemoteParticipant): Promise<void> {
    if (track.kind !== 'video') {
      console.warn('[Syntera Avatar] Track is not video, ignoring')
      return
    }

    try {
      // Remove initial static avatar if it exists (replace with video)
      const initialAvatar = this.config.container.querySelector('#syntera-initial-avatar')
      if (initialAvatar) {
        initialAvatar.remove()
      }

      // Create container for avatar if it doesn't exist
      if (!this.container) {
        this.container = document.createElement('div')
        this.container.className = 'syntera-avatar-container'
        this.container.id = 'syntera-video-avatar'
        this.container.style.cssText = `
          width: 100%;
          aspect-ratio: 16/9;
          background: #000;
          border-radius: 12px;
          overflow: hidden;
          margin: 12px 0;
          position: relative;
        `
        // Insert at the beginning of messages container (before any messages)
        const firstChild = this.config.container.firstChild
        if (firstChild) {
          this.config.container.insertBefore(this.container, firstChild)
        } else {
          this.config.container.appendChild(this.container)
        }
      }

      // Create video element if it doesn't exist
      if (!this.videoElement) {
        this.videoElement = document.createElement('video')
        this.videoElement.autoplay = true
        this.videoElement.playsInline = true
        this.videoElement.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
        `
        this.container.appendChild(this.videoElement)
      }

      // Detach previous track if any
      if (this.currentTrack) {
        this.currentTrack.detach()
      }

      // Attach new track
      this.currentTrack = track
      track.attach(this.videoElement)

      this.isPlaying = true
    } catch (error) {
      console.error('[Syntera Avatar] Failed to start avatar:', error)
      throw error
    }
  }

  /**
   * Start avatar stream (legacy method - kept for compatibility)
   */
  async start(): Promise<void> {
    // This method is kept for compatibility but should use startWithTrack instead
    console.warn('[Syntera Avatar] start() called without track. Use startWithTrack() instead.')
  }

  /**
   * Stop avatar stream
   */
  stop(): void {
    if (this.currentTrack) {
      this.currentTrack.detach()
      this.currentTrack = null
    }

    if (this.videoElement) {
      this.videoElement.pause()
      this.videoElement.srcObject = null
      this.videoElement = null
    }

    if (this.container) {
      this.container.remove()
      this.container = null
    }

    this.isPlaying = false
  }

  /**
   * Check if avatar is playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying
  }
}

