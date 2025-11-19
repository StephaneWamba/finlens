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
    const { egressId, recordingId } = body

    if (!egressId) {
      return NextResponse.json(
        { error: 'egressId is required' },
        { status: 400 }
      )
    }

    // Get auth token for agent service
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return NextResponse.json({ error: 'No session' }, { status: 401 })
    }

    const response = await fetch(`${AGENT_SERVICE_URL}/api/call-recordings/stop-egress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ egressId, recordingId }),
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json(
        { error: error || 'Failed to stop egress' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Stop egress error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


