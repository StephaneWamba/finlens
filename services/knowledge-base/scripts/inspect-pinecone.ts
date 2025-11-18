/**
 * Script to inspect Pinecone content
 * Run with: pnpm inspect:pinecone [company-id]
 */

import 'dotenv/config'
import { Pinecone } from '@pinecone-database/pinecone'
import { createClient } from '@supabase/supabase-js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('inspect-pinecone')

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'syntera-knowledge-base'
const NAMESPACE_PREFIX = 'company'

async function inspectPinecone() {
  try {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY not set')
    }

    // Pinecone SDK v6+ - for serverless (pcsk_ keys), environment is auto-detected
    const isServerless = process.env.PINECONE_API_KEY.startsWith('pcsk_')
    const pineconeConfig: any = {
      apiKey: process.env.PINECONE_API_KEY,
    }
    
    // Only add environment for non-serverless (legacy) indexes
    if (!isServerless) {
      const environment = process.env.PINECONE_ENVIRONMENT || 'us-east-1-aws'
      pineconeConfig.environment = environment
    }
    
    const pinecone = new Pinecone(pineconeConfig)

    logger.info(`Connecting to Pinecone index: ${INDEX_NAME}`)
    const index = pinecone.Index(INDEX_NAME)

    // Query with a zero vector to get sample vectors
    // Pinecone index is configured for 1024 dimensions
    const embeddingDimensions = 1024
    const zeroVector = new Array(embeddingDimensions).fill(0)

    console.log('\n🔍 Querying index for sample vectors...')
    
    // Query default namespace
    try {
      const defaultQuery = await index.query({
        vector: zeroVector,
        topK: 10,
        includeMetadata: true,
      })

      console.log(`\n📊 Default Namespace:`)
      console.log(`Found ${defaultQuery.matches?.length || 0} vectors`)
      
      if (defaultQuery.matches && defaultQuery.matches.length > 0) {
        defaultQuery.matches.forEach((match, i) => {
          console.log(`\n  Vector ${i + 1}:`)
          console.log(`    ID: ${match.id}`)
          console.log(`    Score: ${match.score?.toFixed(4)}`)
          if (match.metadata) {
            console.log(`    Metadata:`)
            console.log(JSON.stringify(match.metadata, null, 6))
          }
        })
      } else {
        console.log('  No vectors found in default namespace')
      }
    } catch (error) {
      console.log('  Could not query default namespace:', error instanceof Error ? error.message : error)
    }

    // Try to get company IDs from Supabase and query their namespaces
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('\n📦 Fetching company IDs from Supabase...')
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )

      const { data: documents } = await supabase
        .from('knowledge_base_documents')
        .select('company_id')
        .not('company_id', 'is', null)
        .limit(10)

      const companyIds = [...new Set(documents?.map(d => d.company_id) || [])]
      
      if (companyIds.length > 0) {
        console.log(`Found ${companyIds.length} company ID(s) with documents`)
        
        for (const companyId of companyIds) {
          const namespace = `${NAMESPACE_PREFIX}-${companyId}`
          console.log(`\n📦 Inspecting namespace: ${namespace}`)
          
          try {
            const namespaceIndex = index.namespace(namespace)
            const namespaceQuery = await namespaceIndex.query({
              vector: zeroVector,
              topK: 10,
              includeMetadata: true,
            })

            console.log(`Found ${namespaceQuery.matches?.length || 0} vectors`)
            
            if (namespaceQuery.matches && namespaceQuery.matches.length > 0) {
              namespaceQuery.matches.forEach((match, i) => {
                console.log(`\n  Vector ${i + 1}:`)
                console.log(`    ID: ${match.id}`)
                console.log(`    Score: ${match.score?.toFixed(4)}`)
                if (match.metadata) {
                  console.log(`    Metadata:`)
                  console.log(JSON.stringify(match.metadata, null, 6))
                }
              })
            } else {
              console.log('  No vectors found in this namespace')
            }
          } catch (error) {
            console.log(`  Could not query namespace ${namespace}:`, error instanceof Error ? error.message : error)
          }
        }
      } else {
        console.log('  No documents found in database')
      }
    } else {
      console.log('\n💡 Tip: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to auto-detect company namespaces')
      const companyId = process.argv[2]
      if (companyId) {
        const namespace = `${NAMESPACE_PREFIX}-${companyId}`
        console.log(`\n📦 Inspecting namespace: ${namespace}`)
        // ... query logic
      }
    }

    logger.info('✅ Inspection complete')
  } catch (error) {
    logger.error('Failed to inspect Pinecone', { error })
    if (error instanceof Error) {
      console.error('\nError details:', error.message)
      if (error.stack) {
        console.error('Stack:', error.stack)
      }
    }
    process.exit(1)
  }
}

inspectPinecone()
