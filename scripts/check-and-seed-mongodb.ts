/**
 * MongoDB Setup Check and Seed Script
 * Verifies setup and seeds MongoDB with real data from Supabase
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { connectMongoDB, disconnectMongoDB } from '../shared/dist/database/mongodb.js'
import { Conversation, Message } from '../shared/dist/models/index.js'
import { existsSync } from 'fs'
import { join } from 'path'

const MONGODB_URI = process.env.MONGODB_URI || ''
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

async function checkAndSeed() {
  console.log('🔍 Checking MongoDB Setup...\n')

  // 1. Check environment variables
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is not set')
    console.error('   Please set it in your .env file')
    process.exit(1)
  }
  console.log('✅ MONGODB_URI is set')
  
  // Fix password encoding if needed (handle # character)
  // The # in password breaks URL parsing, need to encode it before parsing
  let mongoUri = MONGODB_URI
  
  // Always check and encode password if it contains #
  // Split at mongodb:// to get the protocol and rest
  if (mongoUri.startsWith('mongodb://')) {
    const afterProtocol = mongoUri.substring(10) // After "mongodb://"
    const atIndex = afterProtocol.indexOf('@')
    
    if (atIndex > 0) {
      const credentials = afterProtocol.substring(0, atIndex)
      const rest = afterProtocol.substring(atIndex)
      
      // Check if credentials contain unencoded #
      if (credentials.includes('#') && !credentials.includes('%23')) {
        const colonIndex = credentials.indexOf(':')
        if (colonIndex > 0) {
          const user = credentials.substring(0, colonIndex)
          const pass = credentials.substring(colonIndex + 1)
          const encodedPass = encodeURIComponent(pass)
          mongoUri = `mongodb://${user}:${encodedPass}${rest}`
          console.log('✅ Fixed password encoding in MongoDB URI')
        }
      }
    }
  }

  // 2. Check for MongoDB certificate
  const certPaths = [
    'global-bundle.pem',
    join(process.cwd(), 'global-bundle.pem'),
    join(process.cwd(), 'services', 'chat', 'global-bundle.pem'),
  ]

  let certFound = false
  for (const certPath of certPaths) {
    if (existsSync(certPath)) {
      console.log(`✅ MongoDB certificate found: ${certPath}`)
      certFound = true
      break
    }
  }

  if (!certFound && mongoUri.includes('tlsCAFile=global-bundle.pem')) {
    console.warn('⚠️  MongoDB certificate (global-bundle.pem) not found')
    console.warn('   Download from: AWS DocumentDB → Connectivity & security → Download certificate')
    console.warn('   Place in project root or update connection string')
    console.warn('   See: docs/DOWNLOAD_MONGODB_CERTIFICATE.md for instructions')
    console.warn('   Attempting connection without certificate (may fail)...\n')
    
    // Try without TLS certificate requirement (for testing only)
    // Remove tlsCAFile parameter if certificate not found
    if (mongoUri.includes('tlsCAFile=global-bundle.pem')) {
      mongoUri = mongoUri.replace(/[?&]tlsCAFile=global-bundle\.pem/, '')
      console.warn('   ⚠️  Removed tlsCAFile parameter (testing without certificate)')
      console.warn('   ⚠️  This is NOT secure for production!\n')
    }
  }

  // 3. Test MongoDB connection
  console.log('📡 Testing MongoDB connection...')
  console.log(`   Using URI: ${mongoUri.substring(0, 50)}...`) // Show first 50 chars
  try {
    await connectMongoDB(mongoUri)
    console.log('✅ MongoDB connected successfully\n')
  } catch (error: any) {
    console.error('❌ MongoDB connection failed:', error.message)
    if (error.message.includes('certificate') || error.message.includes('tls')) {
      console.error('   This is likely a certificate issue')
      console.error('   Download global-bundle.pem from AWS DocumentDB console')
    } else if (error.message.includes('Unable to parse')) {
      console.error('   Password encoding issue detected')
      console.error('   The password contains special characters that need encoding')
    }
    process.exit(1)
  }

  // 4. Check if data already exists
  const existingConversations = await Conversation.countDocuments()
  if (existingConversations > 0) {
    console.log(`⚠️  Found ${existingConversations} existing conversations in MongoDB`)
    console.log('   Skipping seed to avoid duplicates')
    console.log('   To re-seed, delete existing data first:\n')
    console.log('   await Conversation.deleteMany({})')
    console.log('   await Message.deleteMany({})\n')
    await disconnectMongoDB()
    process.exit(0)
  }

  // 5. Get real IDs from Supabase
  console.log('📡 Fetching real IDs from Supabase...')
  let companyId = '00000000-0000-0000-0000-000000000001'
  let agentId = '00000000-0000-0000-0000-000000000002'
  let contactId = '00000000-0000-0000-0000-000000000003'

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      // Get first company
      const { data: companies, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .limit(1)

      if (!companyError && companies && companies.length > 0) {
        companyId = companies[0].id
        console.log(`✅ Found company: ${companyId}`)
      } else {
        console.log('⚠️  No companies found in Supabase, using placeholder')
        console.log('   Create a company by signing up a user first')
      }

      // Get first agent config
      const { data: agents, error: agentError } = await supabase
        .from('agent_configs')
        .select('id')
        .limit(1)

      if (!agentError && agents && agents.length > 0) {
        agentId = agents[0].id
        console.log(`✅ Found agent: ${agentId}`)
      } else {
        console.log('⚠️  No agents found in Supabase, using placeholder')
      }

      // Get first contact
      const { data: contacts, error: contactError } = await supabase
        .from('contacts')
        .select('id')
        .limit(1)

      if (!contactError && contacts && contacts.length > 0) {
        contactId = contacts[0].id
        console.log(`✅ Found contact: ${contactId}`)
      } else {
        console.log('⚠️  No contacts found in Supabase, using placeholder')
      }
    } catch (error: any) {
      console.warn('⚠️  Could not fetch from Supabase:', error.message)
      console.warn('   Using placeholder IDs\n')
    }
  } else {
    console.warn('⚠️  Supabase credentials not found, using placeholder IDs\n')
  }

  // 6. Seed data
  console.log('🌱 Seeding MongoDB...\n')

  try {
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

    // Create sample messages
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

    console.log('\n✨ MongoDB seeded successfully!')
    console.log(`   - ${createdConversations.length} conversations`)
    console.log(`   - ${messages.length} messages`)
    console.log('\n✅ Setup complete!')

    await disconnectMongoDB()
    process.exit(0)
  } catch (error: any) {
    console.error('❌ Error seeding data:', error.message)
    await disconnectMongoDB()
    process.exit(1)
  }
}

checkAndSeed()

