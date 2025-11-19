/**
 * LiveKit Client Wrapper
 * Manages LiveKit room connections and tracks
 */

import { Room, RoomEvent, Track, RemoteParticipant, LocalTrack, LocalAudioTrack, LocalVideoTrack, LocalParticipant, TrackPublication } from 'livekit-client'

export interface LiveKitClientCallbacks {
  onParticipantConnected?: (participant: RemoteParticipant) => void
  onParticipantDisconnected?: (participant: RemoteParticipant) => void
  onTrackSubscribed?: (track: Track, participant: RemoteParticipant) => void
  onTrackUnsubscribed?: (track: Track, participant: RemoteParticipant) => void
  onAudioPlaybackStatusChanged?: (isPlaying: boolean) => void
  onDisconnected?: () => void
  onError?: (error: Error) => void
}

// Shared state for console.error wrapping to handle multiple instances
let originalConsoleError: typeof console.error | null = null
let consoleErrorWrapperCount = 0
const dataChannelErrorPattern = /Unknown DataChannel error on (lossy|reliable)/

function wrapConsoleError() {
  if (originalConsoleError === null) {
    originalConsoleError = console.error
  }
  
  consoleErrorWrapperCount++
  
  console.error = (...args: unknown[]) => {
    const message = args[0]
    if (typeof message === 'string' && dataChannelErrorPattern.test(message)) {
      // Suppress DataChannel errors - they're non-critical warnings
      return
    }
    originalConsoleError!.apply(console, args)
  }
}

function unwrapConsoleError() {
  consoleErrorWrapperCount--
  if (consoleErrorWrapperCount <= 0 && originalConsoleError !== null) {
    const restored = originalConsoleError
    originalConsoleError = null
    consoleErrorWrapperCount = 0
    console.error = restored
  }
}

export class LiveKitClient {
  private room: Room | null = null
  private callbacks: LiveKitClientCallbacks = {}

  async connect(token: string, url: string, callbacks?: LiveKitClientCallbacks): Promise<Room> {
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
      this.callbacks.onTrackSubscribed?.(track, participant)
    })

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      this.callbacks.onTrackUnsubscribed?.(track, participant)
    })

    room.on(RoomEvent.AudioPlaybackStatusChanged, (isPlaying) => {
      this.callbacks.onAudioPlaybackStatusChanged?.(isPlaying)
    })

    // Suppress non-critical DataChannel errors
    // These occur when DataChannels fail to establish, which is common and non-critical for audio calls
    wrapConsoleError()

    // Restore console.error on disconnect
    room.on(RoomEvent.Disconnected, () => {
      unwrapConsoleError()
      this.callbacks.onDisconnected?.()
      this.room = null
    })

    try {
      // Validate inputs
      if (!token || !url) {
        throw new Error('Token and URL are required')
      }

      if (!url.startsWith('wss://')) {
        throw new Error(`Invalid LiveKit URL format: ${url}. Must start with wss://`)
      }

      await room.connect(url, token)
      this.room = room
      return room
    } catch (error) {
      // Restore console.error on error
      unwrapConsoleError()
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('LiveKit connection error:', {
        error: errorMessage,
        url,
        tokenLength: token?.length,
        hasToken: !!token,
      })
      this.callbacks.onError?.(error as Error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.room) {
      this.room.disconnect()
      this.room = null
    }
    // Note: console.error restoration is handled by Disconnected event handler
  }

  async toggleMute(): Promise<boolean> {
    if (!this.room) {
      throw new Error('Not connected to room')
    }

    const isMuted = this.room.localParticipant.isMicrophoneEnabled
    await this.room.localParticipant.setMicrophoneEnabled(!isMuted)
    return !isMuted
  }

  async toggleVideo(): Promise<boolean> {
    if (!this.room) {
      throw new Error('Not connected to room')
    }

    const isEnabled = this.room.localParticipant.isCameraEnabled
    await this.room.localParticipant.setCameraEnabled(!isEnabled)
    return !isEnabled
  }

  async enableAudio(): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to room')
    }
    await this.room.localParticipant.setMicrophoneEnabled(true)
  }

  async disableAudio(): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to room')
    }
    await this.room.localParticipant.setMicrophoneEnabled(false)
  }

  async enableVideo(): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to room')
    }
    await this.room.localParticipant.setCameraEnabled(true)
  }

  async disableVideo(): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to room')
    }
    await this.room.localParticipant.setCameraEnabled(false)
  }

  getRoom(): Room | null {
    return this.room
  }

  getParticipants(): RemoteParticipant[] {
    if (!this.room) {
      return []
    }
    return Array.from(this.room.remoteParticipants.values())
  }

  getLocalTracks(): LocalTrack[] {
    if (!this.room) {
      return []
    }
    const tracks: LocalTrack[] = []
    this.room.localParticipant.trackPublications.forEach((publication: TrackPublication) => {
      if (publication.track && publication.track instanceof LocalTrack) {
        tracks.push(publication.track)
      }
    })
    return tracks
  }

  getAudioTracks(): LocalAudioTrack[] {
    return this.getLocalTracks().filter(
      (track): track is LocalAudioTrack => track.kind === 'audio'
    )
  }

  getVideoTracks(): LocalVideoTrack[] {
    return this.getLocalTracks().filter(
      (track): track is LocalVideoTrack => track.kind === 'video'
    )
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

  isVideoEnabled(): boolean {
    if (!this.room) {
      return false
    }
    return this.room.localParticipant.isCameraEnabled
  }
}

