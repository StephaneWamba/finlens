import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || process.env.NEXT_PUBLIC_AGENT_SERVICE_URL || 'http://localhost:4002'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { recordingId, roomName } = body

    if (!recordingId || !roomName) {
      return NextResponse.json(
        { error: 'recordingId and roomName are required' },
        { status: 400 }
      )
    }

    // Get auth token for agent service
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return NextResponse.json({ error: 'No session' }, { status: 401 })
    }

    const response = await fetch(`${AGENT_SERVICE_URL}/api/call-recordings/start-egress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ recordingId, roomName }),
    })

    if (!response.ok) {
      let errorMessage = 'Failed to start egress'
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorData.message || errorMessage
        console.error('Agent service error:', errorData)
      } catch {
        const errorText = await response.text()
        errorMessage = errorText || errorMessage
        console.error('Agent service error (text):', errorText)
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Start egress error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

