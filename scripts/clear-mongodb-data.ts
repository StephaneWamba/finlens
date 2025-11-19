/**
 * Clear MongoDB Data Script
 * Clears all conversations and messages from MongoDB
 * 
 * Usage:
 *   pnpm run db:clear-all
 *   or
 *   tsx scripts/clear-mongodb-data.ts
 */

import 'dotenv/config'
import { connectMongoDB, disconnectMongoDB } from '../shared/src/database/mongodb.js'
import { Conversation, Message } from '../shared/src/models/index.js'

// Default to Docker MongoDB if MONGODB_URI is not set
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/syntera'

async function clearMongoDB() {
  try {
    console.log('🔍 Clearing MongoDB data...\n')

    // Check if MongoDB URI is set or use default Docker connection
    if (!process.env.MONGODB_URI) {
      console.log('⚠️  MONGODB_URI not set, using default Docker MongoDB: mongodb://localhost:27017/syntera')
      console.log('   Make sure Docker MongoDB is running: docker-compose up -d mongodb\n')
    } else {
      console.log(`📡 Using MongoDB URI from environment variable`)
    }

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...')
    
    // For Docker MongoDB, ensure SSL is disabled and no auth if not needed
    let connectionUri = MONGODB_URI
    if (connectionUri.includes('localhost') || connectionUri.includes('127.0.0.1')) {
      // For local Docker MongoDB, use simple connection without auth
      let dbName = 'syntera'
      try {
        const url = new URL(connectionUri)
        const pathParts = url.pathname.split('/').filter(p => p)
        if (pathParts.length > 0) {
          dbName = pathParts[pathParts.length - 1]
        }
      } catch {
        const dbMatch = connectionUri.match(/\/([^/?]+)(?:\?|$)/)
        if (dbMatch) {
          dbName = dbMatch[1]
        }
      }
      connectionUri = `mongodb://localhost:27017/${dbName}`
      console.log(`   Using Docker MongoDB connection: ${connectionUri}`)
    }
    
    await connectMongoDB(connectionUri)
    console.log('✅ MongoDB connected\n')

    // Count existing data
    const conversationCount = await Conversation.countDocuments()
    const messageCount = await Message.countDocuments()

    console.log(`📊 Current data in MongoDB:`)
    console.log(`   Conversations: ${conversationCount}`)
    console.log(`   Messages: ${messageCount}\n`)

    if (conversationCount === 0 && messageCount === 0) {
      console.log('✅ No data to delete. Database is already empty.')
      await disconnectMongoDB()
      return
    }

    console.log('🗑️  Deleting all conversations and messages...\n')

    // Delete messages first (they reference conversations)
    console.log('🗑️  Deleting messages...')
    const messageResult = await Message.deleteMany({})
    console.log(`   ✅ Deleted ${messageResult.deletedCount} messages`)

    // Delete conversations
    console.log('\n🗑️  Deleting conversations...')
    const conversationResult = await Conversation.deleteMany({})
    console.log(`   ✅ Deleted ${conversationResult.deletedCount} conversations`)

    // Verify deletion
    const remainingConversations = await Conversation.countDocuments()
    const remainingMessages = await Message.countDocuments()

    console.log('\n✅ MongoDB data cleared!')
    console.log(`   Remaining conversations: ${remainingConversations}`)
    console.log(`   Remaining messages: ${remainingMessages}`)

    await disconnectMongoDB()
    console.log('\n✅ Disconnected from MongoDB')
  } catch (error) {
    console.error('❌ Error clearing MongoDB data:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  clearMongoDB()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { clearMongoDB }

