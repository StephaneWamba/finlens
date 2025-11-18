import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cache } from '@/lib/api/cache'

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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.company_id) {
      return NextResponse.json(
        { error: 'User company not found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { query, topK = 10, agentId } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const searchCacheKey = `kb-search-${userData.company_id}-${query}-${topK}-${agentId || 'none'}`
    const cached = cache.get<unknown>(searchCacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'private, max-age=30',
          'X-Cache': 'HIT',
        },
      })
    }

    const knowledgeBaseServiceUrl =
      process.env.KNOWLEDGE_BASE_SERVICE_URL || process.env.NEXT_PUBLIC_KNOWLEDGE_BASE_SERVICE_URL || 'http://localhost:4005'

    const response = await fetch(`${knowledgeBaseServiceUrl}/api/documents/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        companyId: userData.company_id,
        topK,
        agentId: agentId || null,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.error || 'Search failed' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    cache.set(searchCacheKey, data, 30000)
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=30',
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


