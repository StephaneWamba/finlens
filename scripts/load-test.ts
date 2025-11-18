/**
 * Load Testing Script
 * Tests concurrent conversations and message throughput
 */

import 'dotenv/config'
import { io, Socket } from 'socket.io-client'
import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || 'http://localhost:4004'

interface TestConfig {
  concurrentConversations: number
  messagesPerConversation: number
  messageInterval: number // ms between messages
  agentId: string
  userEmail: string
  userPassword: string
}

interface TestResult {
  totalConversations: number
  totalMessages: number
  successfulMessages: number
  failedMessages: number
  averageResponseTime: number
  errors: Array<{ type: string; message: string }>
}

/**
 * Get authentication token
 */
async function getAuthToken(email: string, password: string): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required.\n' +
      'Please ensure your .env file contains these values or set them as environment variables.'
    )
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.session) {
    throw new Error(`Authentication failed: ${error?.message || 'No session'}`)
  }

  return data.session.access_token
}

/**
 * Create a conversation
 */
async function createConversation(
  socket: Socket,
  agentId: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for conversation creation'))
    }, 10000)

    socket.once('conversation:created', (data: { id: string }) => {
      clearTimeout(timeout)
      resolve(data.id)
    })

    socket.once('error', (error: { message: string }) => {
      clearTimeout(timeout)
      reject(new Error(error.message))
    })

    socket.emit('conversation:create', {
      agentId,
      channel: 'chat',
    })
  })
}

/**
 * Send a message and wait for response
 */
async function sendMessageAndWait(
  socket: Socket,
  conversationId: string,
  content: string
): Promise<{ responseTime: number; success: boolean }> {
  return new Promise((resolve) => {
    const startTime = Date.now()
    let responseReceived = false

    const timeout = setTimeout(() => {
      if (!responseReceived) {
        resolve({ responseTime: Date.now() - startTime, success: false })
      }
    }, 60000) // 60 second timeout (increased for better reliability)

    // Listen for agent response
    const onMessage = (data: { role?: string; senderType?: string; content?: string }) => {
      const isAgentResponse = 
        data.role === 'assistant' || 
        data.senderType === 'agent' ||
        (data.role === 'assistant' && data.content)
      
      if (isAgentResponse && !responseReceived) {
        responseReceived = true
        clearTimeout(timeout)
        socket.off('message', onMessage)
        resolve({ responseTime: Date.now() - startTime, success: true })
      }
    }

    socket.on('message', onMessage)

    // Send message
    socket.emit('message:send', {
      conversationId,
      content,
      messageType: 'text',
    })
  })
}

/**
 * Run a single conversation test
 */
async function runConversationTest(
  config: TestConfig,
  token: string,
  conversationNumber: number
): Promise<{
  conversationId: string
  messages: number
  successful: number
  failed: number
  responseTimes: number[]
  errors: Array<{ type: string; message: string }>
}> {
  const socket = io(CHAT_SERVICE_URL, {
    auth: { token },
    transports: ['websocket'],
  })

  const errors: Array<{ type: string; message: string }> = []
  const responseTimes: number[] = []

  return new Promise((resolve) => {
    socket.on('connect', async () => {
      try {
        // Create conversation
        const conversationId = await createConversation(socket, config.agentId)
        console.log(`[Conversation ${conversationNumber}] Created: ${conversationId}`)

        let successful = 0
        let failed = 0

        // Send messages
        for (let i = 0; i < config.messagesPerConversation; i++) {
          const message = `Test message ${i + 1} from conversation ${conversationNumber}`
          
          const result = await sendMessageAndWait(socket, conversationId, message)
          
          if (result.success) {
            successful++
            responseTimes.push(result.responseTime)
            console.log(`[Conversation ${conversationNumber}] Message ${i + 1}: ${result.responseTime}ms`)
          } else {
            failed++
            errors.push({ type: 'timeout', message: `Message ${i + 1} timed out` })
          }

          // Wait before next message
          if (i < config.messagesPerConversation - 1) {
            await new Promise((r) => setTimeout(r, config.messageInterval))
          }
        }

        socket.disconnect()
        resolve({
          conversationId,
          messages: config.messagesPerConversation,
          successful,
          failed,
          responseTimes,
          errors,
        })
      } catch (error) {
        errors.push({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
        socket.disconnect()
        resolve({
          conversationId: '',
          messages: 0,
          successful: 0,
          failed: 0,
          responseTimes: [],
          errors,
        })
      }
    })

    socket.on('connect_error', (error) => {
      errors.push({ type: 'connection', message: error.message })
      socket.disconnect()
      resolve({
        conversationId: '',
        messages: 0,
        successful: 0,
        failed: 0,
        responseTimes: [],
        errors,
      })
    })
  })
}

/**
 * Run load test
 */
async function runLoadTest(config: TestConfig): Promise<TestResult> {
  console.log('Starting load test...')
  console.log(`Configuration:`)
  console.log(`  Concurrent conversations: ${config.concurrentConversations}`)
  console.log(`  Messages per conversation: ${config.messagesPerConversation}`)
  console.log(`  Message interval: ${config.messageInterval}ms`)
  console.log(`  Agent ID: ${config.agentId}`)
  console.log(`  User email: ${config.userEmail}`)
  console.log('')

  // Check environment variables
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing required environment variables:\n' +
      `  SUPABASE_URL: ${SUPABASE_URL ? '✅' : '❌ Missing'}\n` +
      `  SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? '✅' : '❌ Missing'}\n` +
      `  CHAT_SERVICE_URL: ${CHAT_SERVICE_URL}\n\n` +
      'Please ensure your .env file is in the project root and contains these variables.'
    )
  }

  // Authenticate
  console.log('Authenticating...')
  const token = await getAuthToken(config.userEmail, config.userPassword)
  console.log('✅ Authenticated\n')

  // Run concurrent conversations
  const startTime = Date.now()
  const promises = Array.from({ length: config.concurrentConversations }, (_, i) =>
    runConversationTest(config, token, i + 1)
  )

  const results = await Promise.all(promises)
  const endTime = Date.now()

  // Aggregate results
  const totalMessages = results.reduce((sum, r) => sum + r.messages, 0)
  const successfulMessages = results.reduce((sum, r) => sum + r.successful, 0)
  const failedMessages = results.reduce((sum, r) => sum + r.failed, 0)
  const allResponseTimes = results.flatMap((r) => r.responseTimes)
  const allErrors = results.flatMap((r) => r.errors)

  const averageResponseTime =
    allResponseTimes.length > 0
      ? allResponseTimes.reduce((sum, t) => sum + t, 0) / allResponseTimes.length
      : 0

  const totalTime = endTime - startTime
  const messagesPerSecond = totalMessages / (totalTime / 1000)

  console.log('\n=== Load Test Results ===')
  console.log(`Total time: ${(totalTime / 1000).toFixed(2)}s`)
  console.log(`Total conversations: ${config.concurrentConversations}`)
  console.log(`Total messages: ${totalMessages}`)
  console.log(`Successful messages: ${successfulMessages}`)
  console.log(`Failed messages: ${failedMessages}`)
  console.log(`Success rate: ${((successfulMessages / totalMessages) * 100).toFixed(2)}%`)
  console.log(`Average response time: ${averageResponseTime.toFixed(2)}ms`)
  console.log(`Messages per second: ${messagesPerSecond.toFixed(2)}`)
  console.log(`Errors: ${allErrors.length}`)

  if (allErrors.length > 0) {
    console.log('\nErrors:')
    allErrors.slice(0, 10).forEach((error) => {
      console.log(`  - ${error.type}: ${error.message}`)
    })
    if (allErrors.length > 10) {
      console.log(`  ... and ${allErrors.length - 10} more errors`)
    }
  }

  return {
    totalConversations: config.concurrentConversations,
    totalMessages,
    successfulMessages,
    failedMessages,
    averageResponseTime,
    errors: allErrors,
  }
}

/**
 * Main function
 */
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(query, resolve)
    })
  }

  console.log('=== Syntera Load Testing Tool ===\n')

  const userEmail = await question(`User email (default: wambstephane@gmail.com): `) || 'wambstephane@gmail.com'
  const userPassword = await question(`User password (default: Durelmorel@25): `) || 'Durelmorel@25'
  
  // Agent ID must be a valid UUID
  const defaultAgentId = '5a2e77c0-aeff-4ea7-af4f-7e7dbed66595'
  let agentId = await question(`Agent ID (default: ${defaultAgentId}): `) || defaultAgentId
  
  // Basic UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(agentId)) {
    console.error(`\n❌ Invalid agent ID format: "${agentId}"`)
    console.error('Agent ID must be a valid UUID (e.g., 123e4567-e89b-12d3-a456-426614174000)')
    process.exit(1)
  }
  const concurrentConversations = parseInt(
    (await question('Number of concurrent conversations (default: 5): ')) || '5',
    10
  )
  const messagesPerConversation = parseInt(
    (await question('Messages per conversation (default: 10): ')) || '10',
    10
  )
  const messageInterval = parseInt(
    (await question('Message interval in ms (default: 1000): ')) || '1000',
    10
  )

  rl.close()

  const config: TestConfig = {
    concurrentConversations,
    messagesPerConversation,
    messageInterval,
    agentId,
    userEmail,
    userPassword,
  }

  try {
    await runLoadTest(config)
    process.exit(0)
  } catch (error) {
    console.error('Load test failed:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module || process.argv[1]?.endsWith('load-test.ts')) {
  main().catch(console.error)
}

export { runLoadTest, TestConfig, TestResult }