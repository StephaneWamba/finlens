'use client'

import { useCallHistory } from '@/lib/api/call-recordings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { Phone, Video, Clock, Users, Play } from 'lucide-react'
import Link from 'next/link'

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
            <div
              key={call.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
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
              <div className="flex items-center gap-2">
                {call.has_recording && call.recording_id && (
                  <Link href={`/dashboard/calls/${call.recording_id}`}>
                    <Button variant="outline" size="sm">
                      <Play className="h-4 w-4 mr-2" />
                      Play
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

