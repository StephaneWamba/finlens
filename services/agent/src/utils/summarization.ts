/**
 * Conversation Summarization Utility
 * Summarizes conversations to manage context window and reduce token usage
 */

import { getOpenAI } from '../services/openai.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:summarization')

// Constants
const SUMMARY_THRESHOLD = 30 // Summarize when conversation has 30+ messages
const SUMMARY_INTERVAL = 20 // Update summary every 20 new messages
const MAX_SUMMARY_LENGTH = 500 // Maximum summary length in characters

export interface ConversationSummary {
  summary: string
  messageCount: number
  updatedAt: Date
}

/**
 * Generate a summary of conversation messages
 */
export async function generateConversationSummary(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const openai = getOpenAI()
  if (!openai) {
    throw new Error('OpenAI client not initialized')
  }

  if (messages.length === 0) {
    return ''
  }

  try {
    // Format messages for summarization
    const conversationText = messages
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n')

    // Create summarization prompt
    const summaryPrompt = `Please provide a concise summary of the following conversation. Focus on:
1. Main topics discussed
2. Key questions asked by the user
3. Important information provided
4. Any decisions or conclusions reached

Keep the summary under ${MAX_SUMMARY_LENGTH} characters.

Conversation:
${conversationText}

Summary:`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates concise conversation summaries.',
        },
        {
          role: 'user',
          content: summaryPrompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more factual summaries
      max_tokens: 250,
    })

    const summary = completion.choices[0]?.message?.content?.trim() || ''
    
    logger.info('Generated conversation summary', {
      messageCount: messages.length,
      summaryLength: summary.length,
    })

    return summary
  } catch (error) {
    logger.error('Failed to generate conversation summary', { error })
    // Return a fallback summary
    return `Conversation with ${messages.length} messages covering various topics.`
  }
}

/**
 * Determine if conversation should be summarized
 */
export function shouldSummarizeConversation(
  messageCount: number,
  lastSummaryCount?: number
): boolean {
  // Summarize if:
  // 1. Conversation has reached threshold (30 messages)
  // 2. 20+ new messages since last summary
  if (messageCount >= SUMMARY_THRESHOLD) {
    if (!lastSummaryCount) {
      return true // First summary
    }
    // Check if enough new messages since last summary
    return messageCount - lastSummaryCount >= SUMMARY_INTERVAL
  }
  return false
}

/**
 * Create optimized conversation history using summary
 * Returns: { messages: recent messages, summary: summary text }
 */
export function optimizeConversationHistory(
  allMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  summary?: string,
  summaryMessageCount?: number
): {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  summary: string | undefined
} {
  // If we have a summary and many messages, use summary + recent messages
  if (summary && summaryMessageCount && allMessages.length > SUMMARY_THRESHOLD) {
    // Get recent messages (last 10) that aren't in the summary
    const recentMessages = allMessages.slice(-10)
    
    return {
      messages: recentMessages,
      summary,
    }
  }

  // Otherwise, use recent messages only (last 20)
  return {
    messages: allMessages.slice(-20),
    summary: undefined,
  }
}

/**
 * Format conversation history with summary for OpenAI
 */
export function formatConversationWithSummary(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  summary?: string
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  const formatted: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []

  // Add summary as system message if available
  if (summary) {
    formatted.push({
      role: 'system',
      content: `Previous conversation summary: ${summary}\n\nContinue the conversation based on this context.`,
    })
  }

  // Add recent messages
  for (const msg of messages) {
    formatted.push({
      role: msg.role,
      content: msg.content,
    })
  }

  return formatted
}