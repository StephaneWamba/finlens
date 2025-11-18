/**
 * Intent Detection Utility
 * Detects user intent from messages to improve agent responses
 */

import { getOpenAI } from '../services/openai.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:intent-detection')

// Intent categories
export type IntentCategory = 
  | 'question'      // User asking a question
  | 'complaint'    // User expressing dissatisfaction
  | 'request'      // User making a request
  | 'purchase'     // User showing purchase intent
  | 'support'      // User needs support/help
  | 'feedback'     // User providing feedback
  | 'greeting'     // User greeting
  | 'goodbye'      // User saying goodbye
  | 'other'        // Other/unclear intent

export interface IntentDetectionResult {
  intent: IntentCategory
  confidence: number
  reasoning?: string
}

/**
 * Detect intent from user message
 */
export async function detectIntent(message: string): Promise<IntentDetectionResult> {
  const openai = getOpenAI()
  if (!openai) {
    // Fallback to simple keyword-based detection
    return detectIntentFallback(message)
  }

  try {
    const prompt = `Analyze the following user message and determine their intent. Respond with ONLY a JSON object in this exact format:
{
  "intent": "question|complaint|request|purchase|support|feedback|greeting|goodbye|other",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

User message: "${message}"

JSON response:`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an intent detection system. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent classification
      max_tokens: 150,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content?.trim() || '{}'
    const result = JSON.parse(responseText) as {
      intent?: string
      confidence?: number
      reasoning?: string
    }

    const intent = (result.intent || 'other') as IntentCategory
    const confidence = Math.min(Math.max(result.confidence || 0.5, 0), 1)

    logger.debug('Intent detected', { intent, confidence, message: message.substring(0, 50) })

    return {
      intent,
      confidence,
      reasoning: result.reasoning,
    }
  } catch (error) {
    logger.warn('Failed to detect intent with AI, using fallback', { error })
    return detectIntentFallback(message)
  }
}

/**
 * Fallback intent detection using keyword matching
 */
function detectIntentFallback(message: string): IntentDetectionResult {
  const lowerMessage = message.toLowerCase()

  // Greeting patterns
  if (/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)/i.test(message)) {
    return { intent: 'greeting', confidence: 0.8 }
  }

  // Goodbye patterns
  if (/^(bye|goodbye|see you|thanks|thank you|thank you very much)/i.test(message)) {
    return { intent: 'goodbye', confidence: 0.8 }
  }

  // Question patterns
  if (/\?/.test(message) || /^(what|how|when|where|why|who|can|could|would|should|is|are|do|does|did)/i.test(message)) {
    return { intent: 'question', confidence: 0.7 }
  }

  // Purchase intent
  if (/(buy|purchase|order|price|cost|payment|checkout|cart)/i.test(lowerMessage)) {
    return { intent: 'purchase', confidence: 0.7 }
  }

  // Complaint patterns
  if (/(problem|issue|error|bug|broken|not working|disappointed|unhappy|angry|frustrated)/i.test(lowerMessage)) {
    return { intent: 'complaint', confidence: 0.7 }
  }

  // Request patterns
  if (/(please|can you|could you|would you|help me|need|want|request)/i.test(lowerMessage)) {
    return { intent: 'request', confidence: 0.6 }
  }

  // Support patterns
  if (/(help|support|assist|guide|how to|tutorial|explain)/i.test(lowerMessage)) {
    return { intent: 'support', confidence: 0.7 }
  }

  // Feedback patterns
  if (/(feedback|suggestion|opinion|think|feel|like|dislike)/i.test(lowerMessage)) {
    return { intent: 'feedback', confidence: 0.6 }
  }

  return { intent: 'other', confidence: 0.5 }
}

/**
 * Get intent-based system prompt enhancement
 */
export function getIntentBasedPromptEnhancement(intent: IntentCategory): string {
  const enhancements: Record<IntentCategory, string> = {
    question: 'The user is asking a question. Provide a clear, helpful, and accurate answer.',
    complaint: 'The user has a complaint. Be empathetic, acknowledge their concern, and work towards a resolution.',
    request: 'The user is making a request. Be helpful and accommodating while staying within your capabilities.',
    purchase: 'The user shows purchase intent. Provide relevant product information and guide them through the process.',
    support: 'The user needs support. Provide step-by-step guidance and be patient with explanations.',
    feedback: 'The user is providing feedback. Listen actively, acknowledge their input, and thank them.',
    greeting: 'The user is greeting you. Respond warmly and offer assistance.',
    goodbye: 'The user is saying goodbye. End the conversation politely and offer future assistance.',
    other: 'Continue the conversation naturally based on context.',
  }

  return enhancements[intent] || enhancements.other
}

