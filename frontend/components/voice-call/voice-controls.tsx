'use client'

import { Button } from '@/components/ui/button'
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceControlsProps {
  isMuted: boolean
  isVideoEnabled: boolean
  onToggleMute: () => void
  onToggleVideo: () => void
  onHangUp: () => void
  disabled?: boolean
}

export function VoiceControls({
  isMuted,
  isVideoEnabled,
  onToggleMute,
  onToggleVideo,
  onHangUp,
  disabled = false,
}: VoiceControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        variant={isMuted ? 'destructive' : 'outline'}
        size="lg"
        onClick={onToggleMute}
        disabled={disabled}
        className="rounded-full h-14 w-14 p-0"
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </Button>

      <Button
        variant={isVideoEnabled ? 'outline' : 'secondary'}
        size="lg"
        onClick={onToggleVideo}
        disabled={disabled}
        className="rounded-full h-14 w-14 p-0"
        aria-label={isVideoEnabled ? 'Turn off video' : 'Turn on video'}
      >
        {isVideoEnabled ? (
          <Video className="h-6 w-6" />
        ) : (
          <VideoOff className="h-6 w-6" />
        )}
      </Button>

      <Button
        variant="destructive"
        size="lg"
        onClick={onHangUp}
        disabled={disabled}
        className="rounded-full h-14 w-14 p-0"
        aria-label="Hang up"
      >
        <PhoneOff className="h-6 w-6" />
      </Button>
    </div>
  )
}


