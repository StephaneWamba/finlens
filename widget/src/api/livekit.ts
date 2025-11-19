/**
 * LiveKit Client Wrapper for Widget
 * Simplified version for embeddable widget
 */

import { Room, RoomEvent, Track, RemoteParticipant, LocalAudioTrack } from 'livekit-client'

export interface LiveKitCallbacks {
  onParticipantConnected?: (participant: RemoteParticipant) => void
  onParticipantDisconnected?: (participant: RemoteParticipant) => void
  onTrackSubscribed?: (track: Track, participant: RemoteParticipant) => void
  onTrackUnsubscribed?: (track: Track, participant: RemoteParticipant) => void
  onDisconnected?: () => void
  onError?: (error: Error) => void
}

export class LiveKitClient {
  private room: Room | null = null
  private callbacks: LiveKitCallbacks = {}
  private audioElement: HTMLAudioElement | null = null

  async connect(url: string, token: string, callbacks?: LiveKitCallbacks): Promise<Room> {
    if (this.room) {
      await this.disconnect()
    }

    this.callbacks = callbacks || {}

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    })

    // Set up event handlers
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      if (participant instanceof RemoteParticipant) {
        this.callbacks.onParticipantConnected?.(participant)
      }
    })

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      this.callbacks.onParticipantDisconnected?.(participant)
    })

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === 'audio' && participant instanceof RemoteParticipant) {
        this.handleAudioTrack(track)
      }
      this.callbacks.onTrackSubscribed?.(track, participant)
    })

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      this.callbacks.onTrackUnsubscribed?.(track, participant)
    })

    room.on(RoomEvent.Disconnected, () => {
      this.cleanup()
      this.callbacks.onDisconnected?.()
      this.room = null
    })

    try {
      if (!token || !url) {
        throw new Error('Token and URL are required')
      }

      if (!url.startsWith('wss://')) {
        throw new Error(`Invalid LiveKit URL format: ${url}. Must start with wss://`)
      }

      await room.connect(url, token)
      this.room = room

      // Enable microphone for voice calls
      try {
        await room.localParticipant.setMicrophoneEnabled(true)
      } catch (error) {
        console.warn('[Syntera LiveKit] Failed to enable microphone:', error)
      }

      return room
    } catch (error) {
      this.cleanup()
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[Syntera LiveKit] Connection error:', errorMessage)
      this.callbacks.onError?.(error as Error)
      throw error
    }
  }

  private handleAudioTrack(track: Track): void {
    if (track.kind !== 'audio') return

    // Create audio element if it doesn't exist
    if (!this.audioElement) {
      this.audioElement = document.createElement('audio')
      this.audioElement.autoplay = true
      this.audioElement.style.display = 'none'
      document.body.appendChild(this.audioElement)
    }

    // Attach track to audio element
    track.attach(this.audioElement)
  }

  private cleanup(): void {
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement.srcObject = null
      this.audioElement.remove()
      this.audioElement = null
    }
  }

  async disconnect(): Promise<void> {
    if (this.room) {
      this.room.disconnect()
      this.room = null
    }
    this.cleanup()
  }

  async toggleMute(): Promise<boolean> {
    if (!this.room) {
      throw new Error('Not connected to room')
    }

    const isMuted = !this.room.localParticipant.isMicrophoneEnabled
    await this.room.localParticipant.setMicrophoneEnabled(!isMuted)
    return !isMuted
  }

  getRoom(): Room | null {
    return this.room
  }

  isConnected(): boolean {
    return this.room?.state === 'connected'
  }

  isMuted(): boolean {
    if (!this.room) {
      return false
    }
    return !this.room.localParticipant.isMicrophoneEnabled
  }
}

