import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || 'http://localhost:4004'

/**
 * PATCH /api/conversations/:id/messages/:messageId
 * Update a message (mark as read, add reaction, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: conversationId, messageId } = await params
    const body = await request.json()

    // Forward to Chat Service
    const response = await fetch(`${CHAT_SERVICE_URL}/api/conversations/${conversationId}/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Update message error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


