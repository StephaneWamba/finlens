import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/csv',
]

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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const agentId = formData.get('agent_id') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not supported. Allowed: PDF, DOC, DOCX, TXT, MD, CSV' },
        { status: 400 }
      )
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${userData.company_id}/${fileName}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    const { data: document, error: dbError } = await supabase
      .from('knowledge_base_documents')
      .insert({
        company_id: userData.company_id,
        agent_id: agentId || null,
        name: file.name,
        file_name: fileName,
        file_path: uploadData.path,
        file_size: file.size,
        file_type: file.type,
        mime_type: file.type,
        status: 'pending',
      })
      .select()
      .single()

    if (dbError) {
      await supabase.storage.from('documents').remove([filePath])
      console.error('Database insert error:', dbError)
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      )
    }

    const knowledgeBaseServiceUrl =
      process.env.KNOWLEDGE_BASE_SERVICE_URL || process.env.NEXT_PUBLIC_KNOWLEDGE_BASE_SERVICE_URL || 'http://localhost:4005'
    
    fetch(`${knowledgeBaseServiceUrl}/api/documents/${document.id}/enqueue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    }).catch((error) => {
      console.warn(
        `Failed to enqueue document ${document.id} for processing:`,
        error.message
      )
    })

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        name: document.name,
        status: document.status,
        created_at: document.created_at,
      },
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


