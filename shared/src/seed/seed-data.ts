/**
 * MongoDB Seed Data
 * For development and testing purposes
 */

import { connectMongoDB } from '../database/mongodb.js'
import { Conversation, Message } from '../models/index.js'

const MONGODB_URI = process.env.MONGODB_URI || ''

async function seedData() {
  try {
    // Connect to MongoDB
    await connectMongoDB(MONGODB_URI)

    console.log('🌱 Starting seed data...')

    // Sample company and agent IDs (replace with actual IDs from Supabase)
    const sampleCompanyId = '00000000-0000-0000-0000-000000000001'
    const sampleAgentId = '00000000-0000-0000-0000-000000000002'
    const sampleContactId = '00000000-0000-0000-0000-000000000003'

    // Clear existing data (optional - comment out if you want to keep existing data)
    // await Conversation.deleteMany({})
    // await Message.deleteMany({})
    // console.log('🗑️  Cleared existing data')

    // Create sample conversations
    const conversations = [
      {
        agent_id: sampleAgentId,
        company_id: sampleCompanyId,
        contact_id: sampleContactId,
        channel: 'chat' as const,
        status: 'active' as const,
        tags: ['support', 'urgent'],
        metadata: {
          source: 'website',
          custom_fields: {
            product: 'Enterprise Plan',
          },
        },
      },
      {
        agent_id: sampleAgentId,
        company_id: sampleCompanyId,
        contact_id: sampleContactId,
        channel: 'chat' as const,
        status: 'ended' as const,
        tags: ['sales'],
        metadata: {
          source: 'widget',
        },
        ended_at: new Date(Date.now() - 3600000), // 1 hour ago
      },
      {
        agent_id: sampleAgentId,
        company_id: sampleCompanyId,
        channel: 'voice' as const,
        status: 'ended' as const,
        tags: ['support'],
        metadata: {
          source: 'phone',
        },
        ended_at: new Date(Date.now() - 7200000), // 2 hours ago
      },
    ]

    const createdConversations = await Conversation.insertMany(conversations)
    console.log(`✅ Created ${createdConversations.length} conversations`)

    // Create sample messages for each conversation
    const messages = []

    for (const conversation of createdConversations) {
      const conversationId = String(conversation._id)
      const conversationMessages = [
        {
          conversation_id: conversationId,
          sender_type: 'user' as const,
          role: 'user' as const,
          content: 'Hello, I need help with my account.',
          message_type: 'text' as const,
          created_at: new Date(conversation.started_at.getTime() + 1000),
        },
        {
          conversation_id: conversationId,
          sender_type: 'agent' as const,
          role: 'assistant' as const,
          content: 'Hello! I\'d be happy to help you with your account. What specific issue are you experiencing?',
          message_type: 'text' as const,
          ai_metadata: {
            model: 'gpt-4-turbo',
            tokens_used: 45,
            response_time_ms: 1200,
            temperature: 0.7,
            finish_reason: 'stop',
          },
          created_at: new Date(conversation.started_at.getTime() + 2000),
        },
        {
          conversation_id: conversationId,
          sender_type: 'user' as const,
          role: 'user' as const,
          content: 'I can\'t log in to my dashboard.',
          message_type: 'text' as const,
          created_at: new Date(conversation.started_at.getTime() + 5000),
        },
        {
          conversation_id: conversationId,
          sender_type: 'agent' as const,
          role: 'assistant' as const,
          content: 'I can help you reset your password. Let me send you a password reset link to your email address.',
          message_type: 'text' as const,
          ai_metadata: {
            model: 'gpt-4-turbo',
            tokens_used: 52,
            response_time_ms: 1500,
            temperature: 0.7,
            finish_reason: 'stop',
          },
          created_at: new Date(conversation.started_at.getTime() + 6000),
        },
      ]

      messages.push(...conversationMessages)
    }

    await Message.insertMany(messages)
    console.log(`✅ Created ${messages.length} messages`)

    console.log('✨ Seed data completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding data:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedData()
}

export { seedData }

