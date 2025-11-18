/**
 * Agent Response Generation Routes
 */

import express, { Request, Response } from 'express'
import { supabase } from '../config/database.js'
import { authenticate, requireCompany, AuthenticatedRequest } from '../middleware/auth.js'
import { generateResponse } from '../services/openai.js'
import { createLogger } from '@syntera/shared/logger/index.js'
import { processAttachments } from '../utils/attachments.js'
import { detectIntent, getIntentBasedPromptEnhancement } from '../utils/intent-detection.js'
import { analyzeSentiment, getSentimentBasedPromptEnhancement } from '../utils/sentiment-analysis.js'
import { z } from 'zod'

const logger = createLogger('agent-service:responses')
const router: express.Router = express.Router()

// Request schema
const GenerateResponseSchema = z.object({
  agentId: z.string().uuid('Invalid agent ID'),
  message: z.string().min(1, 'Message is required').max(5000, 'Message too long'),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).optional(),
  includeKnowledgeBase: z.boolean().optional().default(true),
  attachments: z.array(z.object({
    url: z.string(),
    type: z.string(),
    name: z.string(),
    size: z.number().optional(),
  })).optional(),
})

/**
 * POST /api/responses/generate
 * Generate an AI response for a user message
 */
router.post(
  '/generate',
  authenticate,
  requireCompany,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate input
      const validationResult = GenerateResponseSchema.safeParse(req.body)
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request',
          details: validationResult.error.issues[0].message,
        })
      }

      const { agentId, message, conversationHistory, includeKnowledgeBase, attachments } = validationResult.data
      const companyId = req.user!.company_id!
      
      // Log attachments if present
      if (attachments && attachments.length > 0) {
        logger.info('Processing message with attachments', {
          attachmentCount: attachments.length,
          attachmentNames: attachments.map(a => a.name)
        })
      }

      // Fetch agent configuration
      const { data: agent, error: agentError } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('id', agentId)
        .eq('company_id', companyId)
        .eq('enabled', true)
        .single()

      if (agentError || !agent) {
        return res.status(404).json({ error: 'Agent not found or disabled' })
      }

      // Retrieve knowledge base context if enabled
      let knowledgeBaseContext: string | undefined
      if (includeKnowledgeBase) {
        try {
          const knowledgeBaseServiceUrl =
            process.env.KNOWLEDGE_BASE_SERVICE_URL || 'http://localhost:4005'

          const searchResponse = await fetch(`${knowledgeBaseServiceUrl}/api/documents/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: message,
              companyId,
              agentId: agent.id, // Use agent config ID for filtering
              topK: 5,
            }),
          })

          if (searchResponse.ok) {
            const searchData = (await searchResponse.json()) as {
              results?: Array<{ metadata?: { [key: string]: unknown }; score?: number }>
            }
            if (searchData.results && searchData.results.length > 0) {
              // Format knowledge base results as context
              const contextTexts = searchData.results
                .slice(0, 3) // Use top 3 results
                .map((result) => {
                  const text = result.metadata?.text || result.metadata?.content || ''
                  return typeof text === 'string' ? text : ''
                })
                .filter((text: string) => text.length > 0)

              if (contextTexts.length > 0) {
                knowledgeBaseContext = contextTexts.join('\n\n---\n\n')
              }
            }
          }
        } catch (kbError) {
          logger.warn('Failed to retrieve knowledge base context', { error: kbError })
          // Continue without knowledge base context
        }
      }

      // Detect intent from user message (non-blocking, but we'll use it if available)
      let intentEnhancement = ''
      let intentResult = null
      try {
        intentResult = await detectIntent(message)
        intentEnhancement = getIntentBasedPromptEnhancement(intentResult.intent)
        logger.debug('Intent detected', { intent: intentResult.intent, confidence: intentResult.confidence })
      } catch (intentError) {
        logger.warn('Failed to detect intent', { error: intentError })
        // Continue without intent enhancement
      }

      // Analyze sentiment from user message
      let sentimentEnhancement = ''
      let sentimentResult = null
      try {
        sentimentResult = await analyzeSentiment(message)
        sentimentEnhancement = getSentimentBasedPromptEnhancement(sentimentResult.sentiment, sentimentResult.score)
        logger.debug('Sentiment analyzed', { 
          sentiment: sentimentResult.sentiment, 
          score: sentimentResult.score,
          confidence: sentimentResult.confidence 
        })
      } catch (sentimentError) {
        logger.warn('Failed to analyze sentiment', { error: sentimentError })
        // Continue without sentiment enhancement
      }

      // Enhance system prompt with intent and sentiment-based guidance
      let enhancedSystemPrompt = agent.system_prompt
      if (intentEnhancement) {
        enhancedSystemPrompt += `\n\n${intentEnhancement}`
      }
      if (sentimentEnhancement) {
        enhancedSystemPrompt += `\n\n${sentimentEnhancement}`
      }

      const enhancedMessage = await processAttachments(message, attachments)
      
      const result = await generateResponse({
        systemPrompt: enhancedSystemPrompt,
        userMessage: enhancedMessage,
        conversationHistory,
        knowledgeBaseContext,
        model: agent.model || 'gpt-4o-mini',
        temperature: agent.temperature || 0.7,
        maxTokens: agent.max_tokens || 800,
      })

      res.json({
        response: result.response,
        metadata: {
          agentId: agent.id,
          model: result.model,
          tokensUsed: result.tokensUsed,
          knowledgeBaseUsed: !!knowledgeBaseContext,
          intent: intentResult ? {
            category: intentResult.intent,
            confidence: intentResult.confidence,
          } : undefined,
          sentiment: sentimentResult ? {
            sentiment: sentimentResult.sentiment,
            score: sentimentResult.score,
            confidence: sentimentResult.confidence,
            emotions: sentimentResult.emotions,
          } : undefined,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to generate response', { error: errorMessage })
      res.status(500).json({ error: 'Failed to generate response' })
    }
  }
)

export default router

