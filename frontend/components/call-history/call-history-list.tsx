'use client'

import { useState } from 'react'
import { useCallHistory, useRecording } from '@/lib/api/call-recordings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { Phone, Video, Clock, Users, Download, ChevronDown, ChevronUp } from 'lucide-react'
import {
  AudioPlayerProvider,
  AudioPlayerButton,
  AudioPlayerProgress,
  AudioPlayerTime,
  AudioPlayerDuration,
  AudioPlayerSpeed,
  useAudioPlayer,
  useAudioPlayerTime,
} from '@/components/ui/audio-player'
import { AudioWaveform } from '@/components/ui/audio-waveform'
import { toast } from 'sonner'
import { useEffect } from 'react'

interface CallHistoryListProps {
  conversationId?: string
  contactId?: string
  limit?: number
}

export function CallHistoryList({ conversationId, contactId, limit = 50 }: CallHistoryListProps) {
  const { data, isLoading, error } = useCallHistory({
    conversationId,
    contactId,
    limit,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading call history...</div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-destructive">Failed to load call history</div>
        </CardContent>
      </Card>
    )
  }

  const history = data?.history || []

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">No call history found</div>
        </CardContent>
      </Card>
    )
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call History</CardTitle>
        <CardDescription>Recent voice and video calls</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((call) => (
            <CallHistoryItem key={call.id} call={call} formatDuration={formatDuration} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function AudioPlayerErrorHandler() {
  const player = useAudioPlayer()
  
  useEffect(() => {
    if (player.error) {
      const errorMessages: Record<number, string> = {
        1: 'Media aborted',
        2: 'Network error - unable to load audio',
        3: 'Audio decoding error',
        4: 'Audio format not supported',
      }
      const message = errorMessages[player.error.code] || `Audio error: ${player.error.message}`
      toast.error(message)
    }
  }, [player.error])

  return null
}

interface CallHistoryItemProps {
  call: {
    id: string
    call_type: 'voice' | 'video'
    status: 'completed' | 'failed' | 'missed' | 'cancelled'
    started_at: string
    duration_seconds: number
    participant_count: number
    has_recording: boolean
    recording_id?: string
  }
  formatDuration: (seconds: number) => string
}

function CallHistoryItem({ call, formatDuration }: CallHistoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { data: recording, isLoading: isLoadingRecording } = useRecording(
    call.recording_id || '',
    { enabled: isExpanded && !!call.recording_id }
  )

  const audioItem = recording?.recording_url
    ? {
        id: call.recording_id!,
        src: recording.recording_url,
      }
    : undefined

  const handleDownload = () => {
    if (recording?.recording_url) {
      window.open(recording.recording_url, '_blank')
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors cursor-pointer"
        onClick={() => call.has_recording && call.recording_id && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="flex-shrink-0">
            {call.call_type === 'video' ? (
              <Video className="h-5 w-5 text-primary" />
            ) : (
              <Phone className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">
                {call.call_type === 'video' ? 'Video Call' : 'Voice Call'}
              </span>
              <Badge variant={call.status === 'completed' ? 'default' : 'secondary'}>
                {call.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatDistanceToNow(new Date(call.started_at), { addSuffix: true })}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatDuration(call.duration_seconds)}</span>
              </div>
              {call.participant_count > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>{call.participant_count} participants</span>
                </div>
              )}
            </div>
          </div>
        </div>
        {call.has_recording && call.recording_id && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      {isExpanded && call.recording_id && (
        <div className="border-t p-4 bg-muted/30">
          {isLoadingRecording ? (
            <div className="text-center text-muted-foreground text-sm py-4">
              Loading recording...
            </div>
          ) : recording?.recording_url && audioItem ? (
            <AudioPlayerProvider>
              <AudioPlayerErrorHandler />
              <InlineAudioPlayer
                audioItem={audioItem}
                recording={recording}
                onDownload={handleDownload}
              />
            </AudioPlayerProvider>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-4">
              No recording available
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface InlineAudioPlayerProps {
  audioItem: { id: string; src: string }
  recording: { recording_url: string; duration_seconds: number }
  onDownload: () => void
}

function InlineAudioPlayer({ audioItem, recording, onDownload }: InlineAudioPlayerProps) {
  const player = useAudioPlayer()
  const time = useAudioPlayerTime()
  // Get current time from the audio player context, only if this item is active
  const currentTime = player.activeItem?.id === audioItem.id && time !== null ? time : 0

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <AudioWaveform
          src={recording.recording_url}
          className="w-full h-16"
          barCount={60}
          currentTime={currentTime}
          duration={recording.duration_seconds}
        />
      </div>
      <div className="flex items-center gap-2">
        <AudioPlayerButton item={audioItem} />
        <Button onClick={onDownload} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
        <AudioPlayerSpeed />
      </div>
      <div className="space-y-2">
        <AudioPlayerProgress className="w-full" />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <AudioPlayerTime />
          <AudioPlayerDuration />
        </div>
      </div>
    </div>
  )
}

