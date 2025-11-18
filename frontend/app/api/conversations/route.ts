/**
 * Next.js API Route - Conversations Proxy
 * Proxies requests to Chat Service with authentication
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || 'http://localhost:4004'

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get access token for Chat Service
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      return NextResponse.json({ error: 'No session token' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const queryString = searchParams.toString()

    // Forward request to Chat Service
    const response = await fetch(`${CHAT_SERVICE_URL}/api/conversations${queryString ? `?${queryString}` : ''}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    // Check content type before parsing
    const contentType = response.headers.get('content-type')
    let data
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      // Handle non-JSON responses (e.g., rate limit HTML)
      const text = await response.text()
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Too many requests', details: 'Please try again later' },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { error: 'Unexpected response from chat service', details: text.substring(0, 100) },
        { status: response.status || 500 }
      )
    }

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Conversations API error:', error)
    
    // Check if it's a connection error
    if (error instanceof Error && (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed'))) {
      return NextResponse.json(
        { 
          error: 'Chat service is not running',
          details: 'Please start the chat service on port 4004'
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

