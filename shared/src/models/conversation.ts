/**
 * MongoDB Conversation Model
 * Shared across services for conversation management
 */

import mongoose, { Schema, Document } from 'mongoose'

export interface IConversation extends Document {
  agent_id: string
  company_id: string
  contact_id?: string // Optional - for CRM integration
  user_id?: string // Optional - for authenticated users
  channel: 'chat' | 'voice' | 'video' | 'email' | 'sms'
  status: 'active' | 'ended' | 'archived'
  started_at: Date
  ended_at?: Date
  tags?: string[]
  metadata?: {
    source?: string // Where conversation started (website, widget, etc.)
    ip_address?: string
    user_agent?: string
    custom_fields?: Record<string, unknown>
    [key: string]: unknown
  }
  summary?: string // Conversation summary for context management
  summary_updated_at?: Date // When summary was last updated
  summary_message_count?: number // Message count when summary was created
  threads?: Array<{
    id: string
    title: string
    created_at: Date
    message_count?: number
  }> // Conversation threads for organizing topics
   created_at: Date
  updated_at: Date
}

const ConversationSchema = new Schema<IConversation>(
  {
    agent_id: {
      type: String,
      required: true,
      index: true,
    },
    company_id: {
      type: String,
      required: true,
      index: true,
    },
    contact_id: {
      type: String,
      index: true,
      sparse: true, // Index only if field exists
    },
    user_id: {
      type: String,
      index: true,
      sparse: true,
    },
    channel: {
      type: String,
      enum: ['chat', 'voice', 'video', 'email', 'sms'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'ended', 'archived'],
      default: 'active',
      index: true,
    },
    started_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ended_at: {
      type: Date,
    },
    tags: {
      type: [String],
      default: [],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    summary: {
      type: String,
    },
    summary_updated_at: {
      type: Date,
    },
    summary_message_count: {
      type: Number,
    },
    threads: {
      type: [{
        id: String,
        title: String,
        created_at: Date,
        message_count: Number,
      }],
      default: [],
    },
  },
  {
    timestamps: true,
  }
)

// Compound indexes for common queries
ConversationSchema.index({ company_id: 1, status: 1, started_at: -1 })
ConversationSchema.index({ company_id: 1, channel: 1, started_at: -1 })
ConversationSchema.index({ agent_id: 1, status: 1, started_at: -1 })
ConversationSchema.index({ contact_id: 1, started_at: -1 })
ConversationSchema.index({ user_id: 1, started_at: -1 })
ConversationSchema.index({ tags: 1 })

// Text index for search (if needed)
ConversationSchema.index({ 'metadata.custom_fields': 'text' })

export const Conversation = mongoose.model<IConversation>(
  'Conversation',
  ConversationSchema
)

