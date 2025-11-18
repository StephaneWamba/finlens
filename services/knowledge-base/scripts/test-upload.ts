/**
 * Test script to upload sample.txt and verify ingestion flow
 */

import 'dotenv/config'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const KNOWLEDGE_BASE_SERVICE_URL = process.env.KNOWLEDGE_BASE_SERVICE_URL || 'http://localhost:4005'

async function testUpload() {
  console.log('Testing document upload and ingestion flow...\n')

  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Read sample file
  const sampleFilePath = join(process.cwd(), 'sample.txt')
  console.log(`Reading file: ${sampleFilePath}`)
  
  let fileContent: Buffer
  try {
    fileContent = readFileSync(sampleFilePath)
    console.log(`File read successfully (${fileContent.length} bytes)\n`)
  } catch (error) {
    console.error('Failed to read sample.txt:', error)
    process.exit(1)
  }

  // Get a test company_id (use first company or create test data)
  const { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('id')
    .limit(1)

  if (companyError || !companies || companies.length === 0) {
    console.error('No companies found. Please create a company first.')
    process.exit(1)
  }

  const companyId = companies[0].id
  console.log(`Using company_id: ${companyId}\n`)

  // Upload file to Supabase Storage
  const fileName = `test-${Date.now()}-sample.txt`
  const filePath = `${companyId}/${fileName}`
  
  console.log('Uploading file to Supabase Storage...')
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, fileContent, {
      contentType: 'text/plain',
      upsert: false,
    })

  if (uploadError) {
    console.error('Storage upload failed:', uploadError)
    process.exit(1)
  }
  console.log(`File uploaded to: ${uploadData.path}\n`)

  // Create document record
  console.log('Creating document record...')
  const { data: document, error: dbError } = await supabase
    .from('knowledge_base_documents')
    .insert({
      company_id: companyId,
      agent_id: null,
      name: 'sample.txt',
      file_name: fileName,
      file_path: uploadData.path,
      file_size: fileContent.length,
      file_type: 'text/plain',
      mime_type: 'text/plain',
      status: 'pending',
    })
    .select()
    .single()

  if (dbError) {
    // Rollback: delete uploaded file
    await supabase.storage.from('documents').remove([filePath])
    console.error('Database insert failed:', dbError)
    process.exit(1)
  }
  console.log(`Document created: ${document.id}\n`)

  // Enqueue document for processing
  console.log('Enqueueing document for processing...')
  try {
    const response = await fetch(`${KNOWLEDGE_BASE_SERVICE_URL}/api/documents/${document.id}/enqueue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    const result = await response.json()
    console.log(`Document enqueued successfully`)
    console.log(`   Job ID: ${result.jobId}`)
    console.log(`   Document ID: ${result.documentId}\n`)

    // Wait a bit and check document status
    console.log('Waiting 5 seconds, then checking document status...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    const { data: updatedDoc, error: statusError } = await supabase
      .from('knowledge_base_documents')
      .select('id, status, chunk_count, vector_count, metadata')
      .eq('id', document.id)
      .single()

    if (statusError) {
      console.error('Failed to check document status:', statusError)
    } else {
      console.log('\nDocument Status:')
      console.log(`   Status: ${updatedDoc.status}`)
      console.log(`   Chunks: ${updatedDoc.chunk_count || 0}`)
      console.log(`   Vectors: ${updatedDoc.vector_count || 0}`)
      
      if (updatedDoc.metadata?.error) {
        console.log(`   Error: ${updatedDoc.metadata.error}`)
      }
    }

    // Check queue stats
    console.log('\nChecking queue statistics...')
    try {
      const queueResponse = await fetch(`${KNOWLEDGE_BASE_SERVICE_URL}/api/documents/queue/stats`)
      if (queueResponse.ok) {
        const queueStats = await queueResponse.json()
        console.log('   Queue Stats:')
        console.log(`   - Waiting: ${queueStats.waiting}`)
        console.log(`   - Active: ${queueStats.active}`)
        console.log(`   - Completed: ${queueStats.completed}`)
        console.log(`   - Failed: ${queueStats.failed}`)
        console.log(`   - Worker Running: ${queueStats.workerRunning ? 'Yes' : 'No'}`)
      }
    } catch (error) {
      console.warn('   Could not fetch queue stats:', (error as Error).message)
    }

    console.log('\nTest completed!')
    console.log(`\nMonitor the document status with:`)
    console.log(`   SELECT * FROM knowledge_base_documents WHERE id = '${document.id}';`)

  } catch (error) {
    console.error('Failed to enqueue document:', error)
    console.error('\nThe document is in "pending" status and will be picked up on service startup.')
    process.exit(1)
  }
}

testUpload().catch((error) => {
  console.error('Test failed:', error)
  process.exit(1)
})

