/**
 * Sentiment Analysis Utility
 * Analyzes emotional tone of messages to improve agent responses and track customer satisfaction
 */

import { getOpenAI } from '../services/openai.js'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:sentiment-analysis')

// Sentiment categories
export type SentimentCategory = 
  | 'positive'    // Happy, satisfied, pleased
  | 'negative'   // Angry, frustrated, disappointed
  | 'neutral'    // Neutral, factual, no strong emotion
  | 'mixed'      // Mixed emotions

export interface SentimentAnalysisResult {
  sentiment: SentimentCategory
  score: number // -1.0 (very negative) to +1.0 (very positive)
  emotions?: string[] // Detected emotions (e.g., ['frustrated', 'disappointed'])
  confidence: number // 0.0 to 1.0
  reasoning?: string
}

/**
 * Analyze sentiment from a message
 */
export async function analyzeSentiment(message: string): Promise<SentimentAnalysisResult> {
  const openai = getOpenAI()
  if (!openai) {
    // Fallback to simple keyword-based sentiment
    return analyzeSentimentFallback(message)
  }

  try {
    const prompt = `Analyze the sentiment and emotional tone of the following message. Respond with ONLY a JSON object in this exact format:
{
  "sentiment": "positive|negative|neutral|mixed",
  "score": -1.0 to 1.0,
  "emotions": ["emotion1", "emotion2"],
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}

Message: "${message}"

JSON response:`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a sentiment analysis system. Always respond with valid JSON only. Analyze the emotional tone accurately.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent analysis
      max_tokens: 200,
      response_format: { type: 'json_object' },
    })

    const responseText = completion.choices[0]?.message?.content?.trim() || '{}'
    const result = JSON.parse(responseText) as {
      sentiment?: string
      score?: number
      emotions?: string[]
      confidence?: number
      reasoning?: string
    }

    const sentiment = (result.sentiment || 'neutral') as SentimentCategory
    const score = Math.min(Math.max(result.score || 0, -1), 1) // Clamp between -1 and 1
    const confidence = Math.min(Math.max(result.confidence || 0.5, 0), 1)
    const emotions = result.emotions || []

    logger.debug('Sentiment analyzed', { 
      sentiment, 
      score, 
      confidence, 
      message: message.substring(0, 50) 
    })

    return {
      sentiment,
      score,
      emotions,
      confidence,
      reasoning: result.reasoning,
    }
  } catch (error) {
    logger.warn('Failed to analyze sentiment with AI, using fallback', { error })
    return analyzeSentimentFallback(message)
  }
}

/**
 * Fallback sentiment analysis using keyword matching
 */
function analyzeSentimentFallback(message: string): SentimentAnalysisResult {
  const lowerMessage = message.toLowerCase()
  
  // Positive indicators
  const positiveWords = [
    'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'happy', 
    'pleased', 'satisfied', 'thank', 'thanks', 'appreciate', 'perfect', 'awesome',
    'good', 'nice', 'helpful', 'brilliant', 'outstanding'
  ]
  
  // Negative indicators
  const negativeWords = [
    'terrible', 'awful', 'horrible', 'hate', 'angry', 'frustrated', 'disappointed',
    'upset', 'annoyed', 'bad', 'worst', 'broken', 'error', 'problem', 'issue',
    'unhappy', 'dissatisfied', 'poor', 'slow', 'wrong', 'fail', 'failed'
  ]
  
  // Strong negative indicators
  const strongNegativeWords = [
    'furious', 'livid', 'outraged', 'disgusted', 'appalled', 'devastated'
  ]
  
  // Strong positive indicators
  const strongPositiveWords = [
    'ecstatic', 'thrilled', 'delighted', 'overjoyed', 'elated'
  ]

  let positiveCount = 0
  let negativeCount = 0
  let strongNegativeCount = 0
  let strongPositiveCount = 0

  // Count positive words
  for (const word of positiveWords) {
    if (lowerMessage.includes(word)) positiveCount++
  }
  for (const word of strongPositiveWords) {
    if (lowerMessage.includes(word)) strongPositiveCount++
  }

  // Count negative words
  for (const word of negativeWords) {
    if (lowerMessage.includes(word)) negativeCount++
  }
  for (const word of strongNegativeWords) {
    if (lowerMessage.includes(word)) strongNegativeCount++
  }

  // Calculate score
  const totalPositive = positiveCount + (strongPositiveCount * 2)
  const totalNegative = negativeCount + (strongNegativeCount * 2)
  const total = totalPositive + totalNegative

  if (total === 0) {
    return { sentiment: 'neutral', score: 0, confidence: 0.6 }
  }

  // Score ranges from -1 to +1
  const score = (totalPositive - totalNegative) / Math.max(total, 1)
  
  let sentiment: SentimentCategory = 'neutral'
  if (score > 0.3) {
    sentiment = 'positive'
  } else if (score < -0.3) {
    sentiment = 'negative'
  } else if (totalPositive > 0 && totalNegative > 0) {
    sentiment = 'mixed'
  }

  const confidence = Math.min(0.7, 0.5 + (Math.abs(score) * 0.2))

  return { sentiment, score, confidence }
}

/**
 * Get sentiment-based system prompt enhancement
 */
export function getSentimentBasedPromptEnhancement(sentiment: SentimentCategory, score: number): string {
  if (sentiment === 'negative' && score < -0.5) {
    return 'The user is expressing strong negative sentiment. Be empathetic, acknowledge their frustration, and prioritize resolving their concern. Use a calm, understanding tone.'
  } else if (sentiment === 'negative') {
    return 'The user shows some dissatisfaction. Be understanding and helpful, focusing on addressing their concerns.'
  } else if (sentiment === 'positive' && score > 0.5) {
    return 'The user is expressing positive sentiment. Match their enthusiasm while remaining professional and helpful.'
  } else if (sentiment === 'positive') {
    return 'The user seems satisfied. Continue providing helpful, friendly assistance.'
  } else if (sentiment === 'mixed') {
    return 'The user has mixed feelings. Be balanced in your response, addressing both positive and negative aspects.'
  }
  
  return '' // Neutral sentiment doesn't need enhancement
}

/**
 * Check if sentiment indicates escalation needed
 */
export function shouldEscalate(sentiment: SentimentAnalysisResult): boolean {
  return sentiment.sentiment === 'negative' && sentiment.score < -0.6 && sentiment.confidence > 0.7
}




