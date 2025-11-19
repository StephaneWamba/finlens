/**
 * LiveKit Service
 * Handles connecting to LiveKit rooms, subscribing to audio, and publishing video tracks
 */

import { Room, RoomEvent, LocalVideoTrack, RemoteTrack, Track, RemoteParticipant, TrackSource } from 'livekit-client'
import { Readable, PassThrough } from 'stream'
import type { LiveKitRoomConfig } from '../types/index.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('avatar-service:livekit')

export class LiveKitService {
  private room: Room | null = null
  private videoTrack: LocalVideoTrack | null = null
  private audioStream: PassThrough | null = null

  async connectToRoom(config: LiveKitRoomConfig): Promise<Room> {
    if (this.room) {
      await this.disconnect()
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    })

    // Set up event handlers
    room.on(RoomEvent.TrackSubscribed, (track: Track, publication: any, participant: RemoteParticipant) => {
      if (track.kind === 'audio' && participant.identity.startsWith('agent:')) {
        logger.info('Agent audio track subscribed', {
          participant: participant.identity,
          trackSid: track.sid,
        })
        this.handleAudioTrack(track)
      }
    })

    room.on(RoomEvent.TrackUnsubscribed, (track: Track) => {
      if (track.kind === 'audio') {
        logger.info('Audio track unsubscribed', { trackSid: track.sid })
        if (this.audioStream) {
          this.audioStream.end()
          this.audioStream = null
        }
      }
    })

    room.on(RoomEvent.Disconnected, () => {
      logger.info('Disconnected from LiveKit room', { roomName: config.roomName })
      this.cleanup()
    })

    try {
      await room.connect(config.url, config.token)
      this.room = room
      logger.info('Connected to LiveKit room', { roomName: config.roomName })
      return room
    } catch (error) {
      logger.error('Failed to connect to LiveKit room', { error })
      throw error
    }
  }

  /**
   * Handle audio track from agent
   * Converts LiveKit audio track to Node.js stream
   */
  private handleAudioTrack(track: RemoteTrack): void {
    if (track.kind !== 'audio') return

    // Create audio stream if it doesn't exist
    if (!this.audioStream) {
      this.audioStream = new PassThrough()
    }

    // Convert LiveKit audio track to stream
    // Note: This is a simplified approach
    // In production, you'd need to properly convert MediaStreamTrack to Node.js stream
    // For now, we'll use a workaround with MediaRecorder or similar
    
    logger.info('Processing audio track for avatar generation', {
      trackSid: track.sid,
    })

    // TODO: Implement proper audio track to stream conversion
    // This requires:
    // 1. Get MediaStreamTrack from LiveKit track
    // 2. Use MediaRecorder or Web Audio API to capture audio
    // 3. Convert to Node.js stream format
  }

  /**
   * Get audio stream from room
   * Returns a stream of audio data from the agent
   */
  getAudioStream(): NodeJS.ReadableStream | null {
    return this.audioStream
  }

  /**
   * Publish video track to room
   * Converts video stream to LiveKit track and publishes it
   */
  async publishVideoTrack(videoStream: NodeJS.ReadableStream): Promise<void> {
    if (!this.room) {
      throw new Error('Not connected to LiveKit room')
    }

    try {
      logger.info('Publishing video track to LiveKit room')
      
      // TODO: Implement proper video track creation from stream
      // This requires:
      // 1. Convert Node.js stream to MediaStream
      // 2. Create LocalVideoTrack from MediaStream
      // 3. Publish to room as avatar participant
      
      // For now, log that we would publish
      logger.warn('Video track publishing not yet fully implemented')
      
    } catch (error) {
      logger.error('Failed to publish video track', { error })
      throw error
    }
  }

  private cleanup(): void {
    if (this.audioStream) {
      this.audioStream.end()
      this.audioStream = null
    }

    if (this.videoTrack) {
      this.videoTrack.stop()
      this.videoTrack = null
    }

    this.room = null
  }

  async disconnect(): Promise<void> {
    this.cleanup()
  }

  getRoom(): Room | null {
    return this.room
  }

  isConnected(): boolean {
    return this.room?.state === 'connected'
  }
}

