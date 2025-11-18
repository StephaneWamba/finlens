import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cache } from '@/lib/api/cache'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cacheKey = `kb-docs-${user.id}`
    const cached = cache.get<{ documents: unknown[] }>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': 'private, max-age=5',
          'X-Cache': 'HIT',
        },
      })
    }

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 10000)
    })

    const operationPromise = (async () => {
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

      const { data: documents, error: documentsError } = await supabase
        .from('knowledge_base_documents')
        .select('id, company_id, agent_id, name, file_name, file_path, file_size, file_type, mime_type, status, chunk_count, vector_count, metadata, created_at, updated_at, processed_at')
        .eq('company_id', userData.company_id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (documentsError) {
        console.error('Error fetching documents:', documentsError)
        return NextResponse.json(
          { error: 'Failed to fetch documents' },
          { status: 500 }
        )
      }

      const response = { documents: documents || [] }
      
      cache.set(cacheKey, response, 5000)

      return NextResponse.json(response, {
        headers: {
          'Cache-Control': 'private, max-age=5',
          'X-Cache': 'MISS',
        },
      })
    })()

    return await Promise.race([operationPromise, timeoutPromise]) as NextResponse
  } catch (error) {
    console.error('Knowledge Base API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    
    if (errorMessage.includes('timeout')) {
      return NextResponse.json(
        { error: 'Request timeout - please try again' },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


