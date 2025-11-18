/**
 * Cleanup Service
 * Handles cleanup of vectors when documents are deleted
 */

import { createLogger } from '@syntera/shared/logger/index.js'
import { getSupabase } from '../config/database.js'
import { deleteVectors } from './pinecone.js'

const logger = createLogger('knowledge-base-service:cleanup')

/**
 * Clean up vectors for a deleted document
 */
export async function cleanupDocumentVectors(documentId: string, companyId: string) {
  try {
    // Get all vector IDs for this document
    // In Pinecone, vectors are stored with IDs like: {documentId}-chunk-{index}
    // We need to construct the pattern and delete all matching vectors
    
    // Since we can't query by metadata pattern directly, we'll need to track vector IDs
    // For now, we'll delete vectors based on the document ID pattern
    // This assumes we know the chunk count, but if not, we can use a wildcard approach
    
    const supabase = getSupabase()
    
    // Get document to find chunk count
    interface DocumentRow {
      chunk_count?: number
      [key: string]: unknown
    }
    
    const { data: document } = await supabase
      .from('knowledge_base_documents')
      .select('chunk_count')
      .eq('id', documentId)
      .single<DocumentRow>()

    if (!document) {
      logger.warn(`Document ${documentId} not found for cleanup`)
      return
    }

    // Generate vector IDs based on chunk count
    const vectorIds: string[] = []
    const chunkCount = typeof document.chunk_count === 'number' ? document.chunk_count : 0
    for (let i = 0; i < chunkCount; i++) {
      vectorIds.push(`${documentId}-chunk-${i}`)
    }

    if (vectorIds.length > 0) {
      await deleteVectors(vectorIds, companyId)
      logger.info(`Cleaned up ${vectorIds.length} vectors for document ${documentId}`)
    }
  } catch (error) {
    logger.error(`Failed to cleanup vectors for document ${documentId}`, { error })
    // Don't throw - cleanup failure shouldn't block document deletion
  }
}


    logger.error(`Failed to cleanup vectors for document ${documentId}`, { error })
    // Don't throw - cleanup failure shouldn't block document deletion
  }
}


    logger.error(`Failed to cleanup vectors for document ${documentId}`, { error })
    // Don't throw - cleanup failure shouldn't block document deletion
  }
}


    logger.error(`Failed to cleanup vectors for document ${documentId}`, { error })
    // Don't throw - cleanup failure shouldn't block document deletion
  }
}

