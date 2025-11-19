'use client'

import { CallHistoryList } from '@/components/call-history/call-history-list'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Phone } from 'lucide-react'

export default function CallsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Phone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Call History</h1>
          <p className="text-muted-foreground">
            View and playback your voice and video call recordings
          </p>
        </div>
      </div>

      <CallHistoryList />
    </div>
  )
}


