/**
 * OpenAI Service
 * Handles OpenAI API interactions for agent responses
 */

import OpenAI from 'openai'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:openai')

let openai: OpenAI | null = null

export function initializeOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not set - OpenAI responses will be disabled')
    return null
  }

  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  logger.info('OpenAI client initialized')
  return openai
}

export function getOpenAI() {
  return openai
}

export interface GenerateResponseOptions {
  systemPrompt: string
  userMessage: string
  conversationHistory?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  knowledgeBaseContext?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface GenerateResponseResult {
  response: string
  tokensUsed: number
  model: string
}

/**
 * Generate an AI response using OpenAI
 */
export async function generateResponse(
  options: GenerateResponseOptions
): Promise<GenerateResponseResult> {
  if (!openai) {
    throw new Error('OpenAI client not initialized')
  }

  const {
    systemPrompt,
    userMessage,
    conversationHistory = [],
    knowledgeBaseContext,
    model = 'gpt-4o-mini',
    temperature = 0.7,
    maxTokens = 800,
  } = options

  try {
    // Build messages array
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

    // System prompt with knowledge base context if available
    let fullSystemPrompt = systemPrompt
    // Add concise response instruction if not already present
    if (!fullSystemPrompt.toLowerCase().includes('concise') && !fullSystemPrompt.toLowerCase().includes('brief')) {
      fullSystemPrompt += '\n\nIMPORTANT: Be concise and direct. Keep responses under 100 words unless detailed explanation is necessary. Get straight to the point.'
    }
    if (knowledgeBaseContext) {
      fullSystemPrompt += `\n\nRelevant context from knowledge base:\n${knowledgeBaseContext}`
    }
    messages.push({
      role: 'system',
      content: fullSystemPrompt,
    })

    // Add conversation history (including system messages from summaries)
    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === 'system' ? 'system' : msg.role,
        content: msg.content,
      })
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage,
    })

    // Call OpenAI API with retry logic
    let completion
    let retries = 0
    const maxRetries = 3
    
    while (retries <= maxRetries) {
      try {
        completion = await openai.chat.completions.create({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        })
        break // Success, exit retry loop
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const isRateLimit = errorMessage.includes('rate_limit') || errorMessage.includes('429')
        const isServerError = errorMessage.includes('500') || errorMessage.includes('503')
        
        if ((isRateLimit || isServerError) && retries < maxRetries) {
          retries++
          const delay = Math.pow(2, retries - 1) * 1000 // Exponential backoff: 1s, 2s, 4s
          logger.warn(`OpenAI API error (attempt ${retries}/${maxRetries}), retrying in ${delay}ms`, {
            error: errorMessage,
            model,
          })
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw error // Re-throw if not retryable or max retries reached
      }
    }
    
    if (!completion) {
      throw new Error('Failed to generate response after retries')
    }

    const response = completion.choices[0]?.message?.content || ''
    const tokensUsed = completion.usage?.total_tokens || 0

    logger.info('Generated response', {
      model,
      tokensUsed,
      responseLength: response.length,
    })

    return {
      response,
      tokensUsed,
      model,
    }
  } catch (error) {
    logger.error('Failed to generate response', { error })
    throw error
  }
}

