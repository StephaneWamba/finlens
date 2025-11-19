import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB for audio recordings
const ALLOWED_TYPES = [
  'audio/webm',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/m4a',
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
    const recordingId = formData.get('recordingId') as string

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
        { error: 'File type not supported' },
        { status: 400 }
      )
    }

    const fileExt = file.name.split('.').pop() || 'webm'
    const fileName = recordingId ? `${recordingId}.${fileExt}` : `${Date.now()}.${fileExt}`
    const filePath = `${userData.company_id}/recordings/${fileName}`

    // Upload to Supabase Storage (use upsert to allow overwriting existing files)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true, // Allow overwriting existing files (handles retries gracefully)
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload recording' },
        { status: 500 }
      )
    }

    // Generate signed URL (valid for 1 year)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('recordings')
      .createSignedUrl(filePath, 31536000) // 1 year

    if (signedUrlError || !signedUrlData) {
      console.error('Error creating signed URL:', signedUrlError)
      return NextResponse.json(
        { error: 'Failed to generate recording URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
      path: filePath,
      type: file.type,
      name: file.name,
      size: file.size,
    })
  } catch (error) {
    console.error('Recording upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


