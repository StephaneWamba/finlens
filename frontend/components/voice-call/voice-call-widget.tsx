'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LiveKitClient, type LiveKitClientCallbacks } from '@/lib/livekit/client'
import { useGenerateLiveKitToken, useDeployVoiceBot } from '@/lib/api/livekit'
import { useConversation } from '@/lib/api/chat'
import { useCreateRecording, useUpdateRecording } from '@/lib/api/call-recordings'
import { Mic, MicOff, PhoneOff, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'

interface VoiceCallWidgetProps {
  conversationId: string
  agentId: string
}

export function VoiceCallWidget({ conversationId, agentId }: VoiceCallWidgetProps) {
  const [client] = useState(() => new LiveKitClient())
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [participants, setParticipants] = useState<string[]>([])
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [agentDeployed, setAgentDeployed] = useState(false)
  const generateToken = useGenerateLiveKitToken()
  const deployBot = useDeployVoiceBot()
  const createRecording = useCreateRecording()
  const updateRecording = useUpdateRecording()
  const { data: conversationData } = useConversation(conversationId)
  const audioRef = useRef<HTMLAudioElement>(null)
  const recordingIdRef = useRef<string | null>(null)
  const callStartTimeRef = useRef<Date | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const connectToRoom = useCallback(async () => {
    if (isConnecting || isConnected) return

    setIsConnecting(true)
    try {
      const tokenData = await generateToken.mutateAsync({
        conversationId,
        agentId,
        participantType: 'user',
      })

      const callbacks: LiveKitClientCallbacks = {
        onParticipantConnected: (participant) => {
          setParticipants((prev) => [...prev, participant.identity])
        },
        onParticipantDisconnected: (participant) => {
          setParticipants((prev) => prev.filter((id) => id !== participant.identity))
        },
        onTrackSubscribed: (track, participant) => {
          if (track.kind === 'audio' && audioRef.current) {
            track.attach(audioRef.current)
          }
        },
        onDisconnected: () => {
          setIsConnected(false)
          setParticipants([])
        },
        onError: (error) => {
          toast.error(`Connection error: ${error.message}`)
          setIsConnected(false)
        },
      }

      await client.connect(tokenData.token, tokenData.url, callbacks)
      setIsConnected(true)
      callStartTimeRef.current = new Date()
      toast.success('Connected to voice call')

      // Enable microphone - required for backend to receive audio input
      try {
        await client.enableAudio()
        setIsMuted(false)
      } catch (error) {
        console.error('Failed to enable microphone:', error)
        toast.error('Failed to enable microphone. Please check permissions.')
        setIsMuted(true)
      }

      // Start recording
      try {
        const recordingData = await createRecording.mutateAsync({
          conversationId,
          agentId,
          roomName: tokenData.roomName,
          roomId: tokenData.roomName,
          startedAt: callStartTimeRef.current.toISOString(),
        })
        recordingIdRef.current = recordingData.recording.id

        // Start browser-side recording
        // Note: This records the user's microphone only. For full call recording (both sides),
        // you would need to use LiveKit's server-side recording or mix audio tracks.
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        })
        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            console.log('Recording chunk received:', event.data.size, 'bytes')
            audioChunksRef.current.push(event.data)
          }
        }

        mediaRecorder.onerror = (event) => {
          console.error('MediaRecorder error:', event)
        }

        // Start recording with timeslice to ensure chunks are emitted regularly
        mediaRecorder.start(1000) // Emit chunk every 1 second
        console.log('Recording started, MediaRecorder state:', mediaRecorder.state)
      } catch (error) {
        console.error('Failed to start recording:', error)
        // Don't block the call if recording fails
      }

      // Automatically deploy the agent after successful connection
      if (!agentDeployed) {
        setIsDeploying(true)
        try {
          await deployBot.mutateAsync({
            conversationId,
            agentId,
          })
          setAgentDeployed(true)
        } catch (error) {
          console.error('Failed to deploy agent:', error)
        } finally {
          setIsDeploying(false)
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to voice call'
      console.error('LiveKit connection failed:', error)
      toast.error(errorMessage)
      setIsConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }, [client, conversationId, agentId, generateToken, deployBot, isConnecting, isConnected, agentDeployed])

  const disconnect = useCallback(async () => {
    try {
      // Calculate duration
      const duration = callStartTimeRef.current
        ? Math.floor((new Date().getTime() - callStartTimeRef.current.getTime()) / 1000)
        : 0

      // Stop recording and wait for final data
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          const mediaRecorder = mediaRecorderRef.current!
          
          // Request final data chunk before stopping
          mediaRecorder.requestData()
          
          // Wait for stop event to ensure all data is collected
          mediaRecorder.onstop = async () => {
            console.log('Recording stopped, chunks:', audioChunksRef.current.length, 'total size:', audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0))
            
            // Stop all tracks
            mediaRecorder.stream.getTracks().forEach(track => track.stop())
            
            // Update recording if it exists
            if (recordingIdRef.current) {
              try {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' })
                console.log('Created audio blob, size:', audioBlob.size, 'bytes')
                
                if (audioBlob.size === 0) {
                  console.warn('Audio blob is empty! Chunks:', audioChunksRef.current.length)
                  toast.error('Recording failed: No audio data captured')
                } else {
                  // Upload recording to storage
                  let recordingUrl: string | undefined
                  let recordingPath: string | undefined
                  
                  try {
                    const formData = new FormData()
                    formData.append('file', audioBlob, `recording-${recordingIdRef.current}.webm`)
                    formData.append('recordingId', recordingIdRef.current)

                    console.log('Uploading recording, size:', audioBlob.size, 'bytes')
                    const uploadResponse = await fetch('/api/call-recordings/upload', {
                      method: 'POST',
                      body: formData,
                    })

                    if (uploadResponse.ok) {
                      const uploadData = await uploadResponse.json()
                      recordingUrl = uploadData.url
                      recordingPath = uploadData.path
                      console.log('Recording uploaded successfully:', recordingPath)
                    } else {
                      const errorData = await uploadResponse.json()
                      console.error('Upload failed:', errorData)
                      toast.error('Failed to upload recording')
                    }
                  } catch (uploadError) {
                    console.error('Failed to upload recording:', uploadError)
                    toast.error('Failed to upload recording')
                  }

                  await updateRecording.mutateAsync({
                    id: recordingIdRef.current,
                    data: {
                      endedAt: new Date().toISOString(),
                      durationSeconds: duration,
                      participants: participants,
                      recordingUrl,
                      recordingStoragePath: recordingPath,
                      fileSizeBytes: audioBlob.size,
                      status: 'completed',
                    },
                  })
                }
              } catch (error) {
                console.error('Failed to update recording:', error)
              }
            }
            
            resolve()
          }
          
          // Stop the recorder
          mediaRecorder.stop()
        })
      }

      await client.disconnect()
      setIsConnected(false)
      setParticipants([])
      recordingIdRef.current = null
      callStartTimeRef.current = null
      toast.info('Disconnected from voice call')
    } catch (error) {
      toast.error('Failed to disconnect')
    }
  }, [client, participants, updateRecording])

  const toggleMute = useCallback(async () => {
    try {
      const newMutedState = await client.toggleMute()
      setIsMuted(newMutedState)
    } catch (error) {
      toast.error('Failed to toggle mute')
    }
  }, [client])

  // Connect on mount
  useEffect(() => {
    connectToRoom()

    return () => {
      disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="flex flex-col h-[600px]">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Voice Call</h2>
            <p className="text-sm text-muted-foreground">
              {conversationData?.conversation?.channel === 'voice' ? 'Voice' : 'Video'} call with agent
            </p>
          </div>
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        {isConnecting ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Connecting to call...</p>
          </div>
        ) : !isConnected ? (
          <div className="flex flex-col items-center gap-4">
            <PhoneOff className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground">Not connected</p>
            <Button onClick={connectToRoom}>Connect</Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-5 w-5" />
                <span className="text-sm">{participants.length + 1} participants</span>
              </div>
              {isDeploying && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Deploying agent...</span>
                </div>
              )}
              {agentDeployed && !isDeploying && (
                <Badge variant="outline" className="text-xs">
                  Agent deployed
                </Badge>
              )}
            </div>

            <div className="flex gap-4">
              <Button
                variant={isMuted ? 'destructive' : 'outline'}
                size="lg"
                onClick={toggleMute}
                className="rounded-full h-16 w-16 p-0"
              >
                {isMuted ? (
                  <MicOff className="h-6 w-6" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
              </Button>

              <Button
                variant="destructive"
                size="lg"
                onClick={disconnect}
                className="rounded-full h-16 w-16 p-0"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </div>
          </>
        )}
      </div>

      <audio ref={audioRef} autoPlay />
    </Card>
  )
}

