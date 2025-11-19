'use client'

import { CallPlayback } from '@/components/call-history/call-playback'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function CallPlaybackPage() {
  const params = useParams()
  const recordingId = params.id as string

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/calls">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call Recording</h1>
          <p className="text-muted-foreground">
            Playback and manage your call recording
          </p>
        </div>
      </div>

      <CallPlayback recordingId={recordingId} />
    </div>
  )
}

