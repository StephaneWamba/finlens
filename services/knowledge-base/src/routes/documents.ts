/**
 * Document API Routes
 */

import express, { Request, Response } from 'express'
import { createLogger } from '@syntera/shared/logger/index.js'
import { enqueueDocument, getQueueStats } from '../services/queue.js'
import { getSupabase } from '../config/database.js'
import { createEmbedding } from '../services/embeddings.js'
import { searchVectors } from '../services/pinecone.js'

const logger = createLogger('knowledge-base-service:routes:documents')
const router: express.Router = express.Router()

/**
 * POST /api/documents/:id/enqueue
 * Enqueue a document for processing
 */
router.post('/:id/enqueue', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // Verify document exists
    const supabase = getSupabase()
    const { data: document, error } = await supabase
      .from('knowledge_base_documents')
      .select('id, status')
      .eq('id', id)
      .single()

    if (error || !document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    // Type assertion for Supabase query result
    const doc = document as { id: string; status: string }
    const docStatus = doc?.status

    if (!docStatus) {
      return res.status(400).json({ error: 'Document status not found' })
    }

    // Only enqueue if status is pending
    if (docStatus !== 'pending') {
      return res.status(400).json({
        error: `Document is not pending (current status: ${docStatus})`,
      })
    }

    // Enqueue the document
    const job = await enqueueDocument(id)

    res.json({
      success: true,
      jobId: job.id,
      documentId: id,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to enqueue document', { error: errorMessage })
    res.status(500).json({ error: 'Failed to enqueue document' })
  }
})

/**
 * GET /api/documents/queue/stats
 * Get queue statistics
 */
router.get('/queue/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getQueueStats()
    const { getDocumentWorker } = await import('../services/queue.js')
    try {
      const worker = getDocumentWorker()
      res.json({
        ...stats,
        workerRunning: worker.isRunning(),
        workerPaused: worker.isPaused(),
      })
    } catch {
      res.json({
        ...stats,
        workerRunning: false,
        workerPaused: false,
      })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to get queue stats', { error: errorMessage })
    res.status(500).json({ error: 'Failed to get queue stats' })
  }
})

/**
 * POST /api/documents/search
 * Search documents using semantic search
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, companyId, topK = 10, agentId } = req.body

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' })
    }

    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' })
    }

    if (query.trim().length === 0) {
      return res.json({ results: [] })
    }

    logger.info(`Searching for: "${query}" (company: ${companyId})`)

    const queryEmbedding = await createEmbedding(query)

    const filter: Record<string, unknown> | undefined = agentId
      ? { agent_id: agentId }
      : undefined

    const matches = await searchVectors(queryEmbedding, companyId, topK, filter)

    const results = matches.map((match) => ({
      id: match.id,
      score: match.score || 0,
      metadata: match.metadata || {},
    }))

    logger.info(`Found ${results.length} results for query: "${query}"`, {
      sampleResult: results[0] ? {
        id: results[0].id,
        score: results[0].score,
        document_id: results[0].metadata?.document_id,
        metadata_keys: Object.keys(results[0].metadata || {}),
      } : null,
    })

    res.json({
      query,
      results,
      count: results.length,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to search documents', { error: errorMessage })
    res.status(500).json({ error: 'Failed to search documents' })
  }
})

export default router

