/**
 * Document Processor
 * Processes documents from the queue: extracts text, chunks, creates embeddings, stores in Pinecone
 */

import { createLogger } from '@syntera/shared/logger/index.js'
import { getSupabase } from '../config/database.js'
import { extractText } from './extractor.js'
import { chunkText } from './chunker.js'
import { createEmbeddings, initializeOpenAI } from './embeddings.js'
import { upsertVectors, deleteVectors } from './pinecone.js'
import { PROCESSING_CONSTANTS } from '../config/constants.js'

const logger = createLogger('knowledge-base-service:processor')

/**
 * Process a single document
 * Exported for use by the queue worker
 * 
 * Timeout: 5 minutes max per document to prevent hanging
 */
export async function processDocument(documentId: string) {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Document processing timeout after ${PROCESSING_CONSTANTS.TIMEOUT_MS / 1000} seconds`))
    }, PROCESSING_CONSTANTS.TIMEOUT_MS)
  })
  
  try {
    logger.info(`Processing document ${documentId}`)
    
    // Race between processing and timeout
    await Promise.race([
      processDocumentInternal(documentId),
      timeoutPromise,
    ])
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Failed to process document ${documentId}`, { 
      error: errorMessage,
      details: error instanceof Error ? { name: error.name, stack: error.stack } : error
    })

    // Update status to failed
    try {
      const supabase = getSupabase()
      await supabase
        .from('knowledge_base_documents')
        // @ts-ignore - Supabase TypeScript types don't support dynamic updates
        .update({
          status: 'failed',
          metadata: {
            error: errorMessage,
            failed_at: new Date().toISOString(),
          },
        })
        .eq('id', documentId)
    } catch (updateError) {
      logger.error(`Failed to update document status to failed for ${documentId}`, { error: updateError })
    }
    throw error
  }
}

/**
 * Internal document processing logic
 */
async function processDocumentInternal(documentId: string) {
  try {

    const supabase = getSupabase()

    // Update status to processing
    await supabase
      .from('knowledge_base_documents')
      // @ts-ignore - Supabase TypeScript types don't support dynamic updates
      .update({ status: 'processing' })
      .eq('id', documentId)

    // Fetch document metadata
    interface DocumentRow {
      id: string
      file_size?: number
      file_path?: string
      mime_type?: string
      file_type?: string
      company_id: string
      agent_id?: string
      name?: string
      metadata?: Record<string, unknown>
      [key: string]: unknown
    }
    
    const { data: document, error: docError } = await supabase
      .from('knowledge_base_documents')
      .select('*')
      .eq('id', documentId)
      .single<DocumentRow>()

    if (docError || !document) {
      throw new Error(`Document not found: ${documentId}`)
    }

    // Check file size before processing
    if (document.file_size && document.file_size > PROCESSING_CONSTANTS.MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `File size (${(document.file_size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${PROCESSING_CONSTANTS.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)`
      )
    }

    // Download file from Supabase Storage
    if (!document.file_path) {
      throw new Error('Document file_path is missing')
    }
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path)

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`)
    }

    // Convert blob to buffer
    const arrayBuffer = await fileData.arrayBuffer()
    let buffer = Buffer.from(arrayBuffer)

    // Extract text
    const extracted = await extractText(buffer, document.mime_type || document.file_type || '')
    
    // Clear buffer from memory
    buffer.fill(0)
    // Buffer is no longer needed, let GC handle it

    // Check extracted text size
    if (extracted.text.length > PROCESSING_CONSTANTS.MAX_TEXT_LENGTH) {
      throw new Error(
        `Extracted text is too large (${(extracted.text.length / 1024 / 1024).toFixed(2)}MB). Maximum allowed: ${PROCESSING_CONSTANTS.MAX_TEXT_LENGTH / 1024 / 1024}MB`
      )
    }

    logger.info(`Extracted ${extracted.text.length} characters from document ${documentId}`)

    // Chunk text
    const chunks = chunkText(extracted.text)
    logger.info(`Document ${documentId} chunked into ${chunks.length} chunks`)

    // Extract chunk texts immediately to avoid holding reference to original text
    const chunkTexts = chunks.map(chunk => chunk.text)
    const chunkMetadata = chunks.map(chunk => ({
      index: chunk.index,
      startIndex: chunk.startIndex,
      endIndex: chunk.endIndex,
    }))
    const totalChunks = chunkTexts.length

    // Clear chunks and extracted text to free memory
    chunks.length = 0
    extracted.text = ''

    // Process embeddings in batches
    const BATCH_SIZE = chunkTexts.length > 100 
      ? PROCESSING_CONSTANTS.BATCH_SIZE_LARGE 
      : PROCESSING_CONSTANTS.BATCH_SIZE_SMALL
    let totalVectorsProcessed = 0
    const totalBatches = Math.ceil(chunkTexts.length / BATCH_SIZE)

    logger.info(`Processing ${chunkTexts.length} chunks in ${totalBatches} batches of ${BATCH_SIZE}`)

    for (let i = 0; i < chunkTexts.length; i += BATCH_SIZE) {
      const batchStart = i
      const batchEnd = Math.min(i + BATCH_SIZE, chunkTexts.length)
      const batchSize = batchEnd - batchStart
      
      const batchChunkTexts = chunkTexts.slice(batchStart, batchEnd)
      const batchChunkMetadata = chunkMetadata.slice(batchStart, batchEnd)
      
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      logger.info(`Processing embedding batch ${batchNumber}/${totalBatches} (${batchSize} chunks)`)
      
      // Create embeddings for this batch
      const embeddings = await createEmbeddings(batchChunkTexts)

      // Prepare vectors for this batch
      const batchVectors = batchChunkMetadata.map((meta, batchIndex) => ({
        id: `${documentId}-chunk-${meta.index}`,
        values: embeddings[batchIndex],
        metadata: {
          document_id: documentId,
          company_id: document.company_id,
          agent_id: document.agent_id,
          chunk_index: meta.index,
          start_index: meta.startIndex,
          end_index: meta.endIndex,
          file_name: document.name,
        },
      }))

      // Upsert batch to Pinecone immediately to free memory
      const upsertSuccess = await upsertVectors(batchVectors, document.company_id)
      if (upsertSuccess) {
        totalVectorsProcessed += batchVectors.length
      } else {
        logger.warn(`Skipped vector storage for batch ${batchNumber} (Pinecone not available)`)
      }
      
      // Clear batch data from memory
      batchVectors.length = 0
      embeddings.length = 0
      batchChunkTexts.length = 0
      batchChunkMetadata.length = 0
      
      // Trigger GC periodically to reduce overhead
      if (global.gc && batchNumber % PROCESSING_CONSTANTS.GC_INTERVAL === 0) {
        global.gc()
      }
      
      // Add delay between batches to prevent overwhelming the system
      if (batchNumber < totalBatches) {
        await new Promise(resolve => setTimeout(resolve, PROCESSING_CONSTANTS.BATCH_DELAY_MS))
      }
    }
    
    // Clear all chunk data after processing
    chunkTexts.length = 0
    chunkMetadata.length = 0

    // Update document status
    await supabase
      .from('knowledge_base_documents')
      // @ts-ignore - Supabase TypeScript types don't support dynamic updates
      .update({
        status: 'completed',
        chunk_count: totalChunks,
        vector_count: totalVectorsProcessed,
        metadata: {
          ...document.metadata,
          extracted: {
            pageCount: extracted.metadata.pageCount,
            wordCount: extracted.metadata.wordCount,
            characterCount: extracted.metadata.characterCount,
          },
        },
        processed_at: new Date().toISOString(),
      })
      .eq('id', documentId)

    logger.info(`Successfully processed document ${documentId}`, {
      vectors: totalVectorsProcessed,
    })
  } catch (error) {
    throw error
  }
}

/**
 * Initialize OpenAI for document processing
 * Should be called once at service startup
 */
export function initializeProcessor() {
  initializeOpenAI()
  logger.info('Document processor initialized')
}

