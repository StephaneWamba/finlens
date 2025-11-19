'use client'

import { useRecording } from '@/lib/api/call-recordings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow, format } from 'date-fns'
import { Clock, Users, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useEffect } from 'react'
import {
  AudioPlayerProvider,
  AudioPlayerButton,
  AudioPlayerProgress,
  AudioPlayerTime,
  AudioPlayerDuration,
  AudioPlayerSpeed,
  useAudioPlayer,
} from '@/components/ui/audio-player'

interface CallPlaybackProps {
  recordingId: string
}

function AudioPlayerErrorHandler() {
  const player = useAudioPlayer()
  
  useEffect(() => {
    if (player.error) {
      const errorMessages: Record<number, string> = {
        1: 'Media aborted',
        2: 'Network error - unable to load audio. The file may not exist or the URL is invalid.',
        3: 'Audio decoding error - the file may be corrupted',
        4: 'Audio format not supported or file is corrupted. The file may not exist in storage.',
      }
      const message = errorMessages[player.error.code] || `Audio error: ${player.error.message}`
      
      console.error('Audio player error:', {
        code: player.error.code,
        message: player.error.message,
        activeItem: player.activeItem,
        src: player.activeItem?.src,
        error: player.error,
      })
      
      const description = player.error.code === 2 
        ? 'Check if the recording file exists in storage and the URL is valid. Try refreshing the page.'
        : player.error.code === 4
        ? 'The file may not exist, be corrupted, or be in an unsupported format. Check the backend logs for details.'
        : 'The audio file may be corrupted or in an unsupported format.'
      
      toast.error(message, {
        description,
        duration: 10000,
      })
    }
  }, [player.error])

  return null
}

export function CallPlayback({ recordingId }: CallPlaybackProps) {
  const { data: recording, isLoading, error } = useRecording(recordingId)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading recording...</div>
        </CardContent>
      </Card>
    )
  }

  if (error || !recording) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <div className="text-destructive font-medium">Failed to load recording</div>
            <div className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Recording not found or you don\'t have access to it'}
            </div>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/dashboard/calls'}
              className="mt-4"
            >
              Back to Call History
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleDownload = () => {
    if (!recording.recording_url) return
    window.open(recording.recording_url, '_blank')
  }

  // Validate and prepare audio item
  const audioItem = (() => {
    if (!recording.recording_url) {
      console.warn('No recording URL available', { 
        recordingId, 
        recording: {
          id: recording.id,
          status: recording.status,
          storage_path: recording.recording_storage_path,
          has_url: !!recording.recording_url
        }
      })
      return undefined
    }

    // Validate URL format
    try {
      const url = new URL(recording.recording_url)
      if (!['http:', 'https:'].includes(url.protocol)) {
        console.error('Invalid URL protocol', { url: recording.recording_url })
        return undefined
      }
      
      console.log('Audio URL validated:', {
        recordingId,
        protocol: url.protocol,
        hostname: url.hostname,
        pathname: url.pathname.substring(0, 50),
        fullUrl: recording.recording_url.substring(0, 100) + '...',
        storagePath: recording.recording_storage_path,
        mimeType: recording.mime_type
      })
    } catch (e) {
      console.error('Invalid recording URL format', { 
        url: recording.recording_url, 
        error: e,
        recordingId 
      })
      return undefined
    }

    return {
      id: recordingId,
      src: recording.recording_url,
    }
  })()


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Call Recording</CardTitle>
              <CardDescription>
                {format(new Date(recording.started_at), 'PPpp')}
              </CardDescription>
            </div>
            <Badge variant={recording.status === 'completed' ? 'default' : 'secondary'}>
              {recording.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{formatDuration(recording.duration_seconds)}</span>
            </div>
            {recording.participants.length > 0 && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{recording.participants.length} participants</span>
              </div>
            )}
          </div>

          {recording.recording_url && audioItem ? (
            <AudioPlayerProvider>
              <AudioPlayerErrorHandler />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AudioPlayerButton item={audioItem} />
                  <Button onClick={handleDownload} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <AudioPlayerSpeed />
                </div>
                <div className="space-y-2">
                  <AudioPlayerProgress className="w-full" />
                  <div className="flex items-center justify-between text-sm">
                    <AudioPlayerTime />
                    <AudioPlayerDuration />
                  </div>
                </div>
                {/* Debug info in development */}
                {process.env.NODE_ENV === 'development' && (
                  <details className="text-xs text-muted-foreground mt-2">
                    <summary className="cursor-pointer">Debug Info</summary>
                    <div className="mt-2 space-y-2 font-mono">
                      <div><strong>Storage Path:</strong> {recording.recording_storage_path || 'N/A'}</div>
                      <div><strong>Status:</strong> {recording.status}</div>
                      <div><strong>MIME Type:</strong> {recording.mime_type || 'N/A'}</div>
                      <div><strong>File Size:</strong> {recording.file_size_bytes ? `${(recording.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</div>
                      <div className="mt-2">
                        <strong>URL:</strong>
                        <div className="break-all bg-muted p-2 rounded mt-1">
                          {recording.recording_url || 'No URL'}
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (recording.recording_url) {
                              window.open(recording.recording_url, '_blank')
                            }
                          }}
                        >
                          Test URL in New Tab
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await fetch(recording.recording_url!, { method: 'HEAD' })
                              console.log('URL test result:', {
                                status: response.status,
                                statusText: response.statusText,
                                headers: Object.fromEntries(response.headers.entries()),
                                ok: response.ok
                              })
                              if (response.ok) {
                                toast.success('File exists and is accessible', {
                                  description: `Status: ${response.status} ${response.statusText}`,
                                })
                              } else {
                                toast.error('File not accessible', {
                                  description: `Status: ${response.status} ${response.statusText}`,
                                })
                              }
                            } catch (error) {
                              console.error('URL test error:', error)
                              toast.error('Failed to test URL', {
                                description: error instanceof Error ? error.message : 'Unknown error',
                              })
                            }
                          }}
                        >
                          Test File Exists
                        </Button>
                      </div>
                    </div>
                  </details>
                )}
              </div>
            </AudioPlayerProvider>
          ) : recording.recording_storage_path ? (
            <div className="text-center space-y-2">
              <div className="text-muted-foreground text-sm">
                Recording file exists but URL could not be generated
              </div>
              <div className="text-xs text-muted-foreground">
                Storage path: {recording.recording_storage_path}
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground text-sm">
              No recording available for this call
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}

