/**
 * MongoDB Seed Script
 * Fetches real IDs from Supabase and seeds MongoDB
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { connectMongoDB, disconnectMongoDB } from '../shared/src/database/mongodb.js'
import { Conversation, Message } from '../shared/src/models/index.js'

const MONGODB_URI = process.env.MONGODB_URI || ''
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function seedMongoDB() {
  try {
    console.log('🔍 Checking setup...')

    // Check MongoDB URI
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set')
    }

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...')
    await connectMongoDB(MONGODB_URI)
    console.log('✅ MongoDB connected')

    // Get real IDs from Supabase
    let companyId = '00000000-0000-0000-0000-000000000001'
    let agentId = '00000000-0000-0000-0000-000000000002'
    let contactId = '00000000-0000-0000-0000-000000000003'

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      console.log('📡 Fetching IDs from Supabase...')
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      // Get first company
      const { data: companies } = await supabase
        .from('companies')
        .select('id')
        .limit(1)

      if (companies && companies.length > 0) {
        companyId = companies[0].id
        console.log(`✅ Found company: ${companyId}`)
      } else {
        console.log('⚠️  No companies found, using placeholder ID')
      }

      // Get first agent config
      const { data: agents } = await supabase
        .from('agent_configs')
        .select('id')
        .limit(1)

      if (agents && agents.length > 0) {
        agentId = agents[0].id
        console.log(`✅ Found agent: ${agentId}`)
      } else {
        console.log('⚠️  No agents found, using placeholder ID')
      }

      // Get first contact
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id')
        .limit(1)

      if (contacts && contacts.length > 0) {
        contactId = contacts[0].id
        console.log(`✅ Found contact: ${contactId}`)
      } else {
        console.log('⚠️  No contacts found, using placeholder ID')
      }
    } else {
      console.log('⚠️  Supabase credentials not found, using placeholder IDs')
    }

    console.log('\n🌱 Starting seed data...')

    // Check if data already exists
    const existingConversations = await Conversation.countDocuments()
    if (existingConversations > 0) {
      console.log(`⚠️  Found ${existingConversations} existing conversations`)
      console.log('   Skipping seed to avoid duplicates')
      console.log('   To re-seed, delete existing data first')
      await disconnectMongoDB()
      process.exit(0)
    }

    // Create sample conversations
    const conversations = [
      {
        agent_id: agentId,
        company_id: companyId,
        contact_id: contactId,
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
        agent_id: agentId,
        company_id: companyId,
        contact_id: contactId,
        channel: 'chat' as const,
        status: 'ended' as const,
        tags: ['sales'],
        metadata: {
          source: 'widget',
        },
        ended_at: new Date(Date.now() - 3600000), // 1 hour ago
      },
      {
        agent_id: agentId,
        company_id: companyId,
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
    const messages: Array<{
      conversation_id: string
      sender_type: 'user' | 'agent' | 'system'
      role: 'user' | 'assistant' | 'system'
      content: string
      message_type: 'text' | 'audio' | 'video' | 'file' | 'image' | 'system'
      ai_metadata?: {
        model?: string
        tokens_used?: number
        response_time_ms?: number
        temperature?: number
        finish_reason?: string
      }
      created_at: Date
    }> = []

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

    console.log('\n✨ Seed data completed successfully!')
    console.log(`   - ${createdConversations.length} conversations`)
    console.log(`   - ${messages.length} messages`)
    
    await disconnectMongoDB()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding data:', error)
    process.exit(1)
  }
}

seedMongoDB()

