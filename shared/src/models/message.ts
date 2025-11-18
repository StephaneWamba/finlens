/**
 * MongoDB Message Model
 * Shared across services for message storage
 */

import mongoose, { Schema, Document } from 'mongoose'

export interface IMessage extends Document {
  conversation_id: string
  thread_id?: string // Optional thread ID for organizing messages
  sender_type: 'user' | 'agent' | 'system'
  role: 'user' | 'assistant' | 'system' // For OpenAI compatibility
  content: string
  message_type: 'text' | 'audio' | 'video' | 'file' | 'image' | 'system'
  attachments?: Array<{
    url: string
    type: string
    name: string
    size?: number
  }>
  ai_metadata?: {
    model?: string
    tokens_used?: number
    response_time_ms?: number
    temperature?: number
    finish_reason?: string
  }
  metadata?: {
    read_at?: Date
    delivered_at?: Date
    edited_at?: Date
    reactions?: Array<{
      emoji: string
      user_id: string
      created_at: Date
    }>
    intent?: {
      category: 'question' | 'complaint' | 'request' | 'purchase' | 'support' | 'feedback' | 'greeting' | 'goodbye' | 'other'
      confidence: number
      reasoning?: string
    }
    sentiment?: {
      sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
      score: number // -1.0 to 1.0
      confidence: number
      emotions?: string[]
      reasoning?: string
    }
    [key: string]: unknown
  }
  created_at: Date
}

const MessageSchema = new Schema<IMessage>(
  {
    conversation_id: {
      type: String,
      required: true,
      index: true,
    },
    thread_id: {
      type: String,
      index: true,
      sparse: true, // Index only if field exists
    },
    sender_type: {
      type: String,
      enum: ['user', 'agent', 'system'],
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    message_type: {
      type: String,
      enum: ['text', 'audio', 'video', 'file', 'image', 'system'],
      default: 'text',
      index: true,
    },
    attachments: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    ai_metadata: {
      type: {
        model: String,
        tokens_used: Number,
        response_time_ms: Number,
        temperature: Number,
        finish_reason: String,
      },
      default: {},
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
  }
)

// Compound indexes for common queries
MessageSchema.index({ conversation_id: 1, created_at: 1 })
MessageSchema.index({ conversation_id: 1, sender_type: 1, created_at: -1 })
MessageSchema.index({ conversation_id: 1, message_type: 1 })
MessageSchema.index({ conversation_id: 1, thread_id: 1, created_at: 1 })

// Index for AI metadata queries (analytics)
MessageSchema.index({ 'ai_metadata.model': 1, created_at: -1 })

export const Message = mongoose.model<IMessage>('Message', MessageSchema)
