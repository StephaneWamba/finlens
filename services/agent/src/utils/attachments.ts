/**
 * Attachment Processing Utilities
 * Handles downloading and processing file attachments for AI responses
 */

import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('agent-service:attachments')

const MAX_FILE_CONTENT_LENGTH = 5000

interface Attachment {
  url: string
  type: string
  name: string
  size?: number
}

/**
 * Process attachments and enhance message with file contents
 * Downloads file content and formats it for inclusion in AI prompt
 */
export async function processAttachments(
  message: string,
  attachments?: Attachment[]
): Promise<string> {
  if (!attachments || attachments.length === 0) {
    return message
  }

  const fileContents: string[] = []

  for (const attachment of attachments) {
    try {
      const fileResponse = await fetch(attachment.url)
      if (fileResponse.ok) {
        const fileText = await fileResponse.text()
        const truncatedContent =
          fileText.length > MAX_FILE_CONTENT_LENGTH
            ? fileText.substring(0, MAX_FILE_CONTENT_LENGTH) + '\n\n[... file truncated ...]'
            : fileText
        fileContents.push(
          `\n--- File: ${attachment.name} (${attachment.type}) ---\n${truncatedContent}\n--- End of ${attachment.name} ---\n`
        )
      } else {
        logger.warn('Failed to download attachment', {
          fileName: attachment.name,
          status: fileResponse.status,
        })
        fileContents.push(
          `\n--- File: ${attachment.name} (${attachment.type}) ---\n[Unable to read file content - download failed]\n--- End of ${attachment.name} ---\n`
        )
      }
    } catch (fileError) {
      logger.error('Error reading attachment', {
        fileName: attachment.name,
        error: fileError instanceof Error ? fileError.message : String(fileError),
      })
      fileContents.push(
        `\n--- File: ${attachment.name} (${attachment.type}) ---\n[Unable to read file content - error occurred]\n--- End of ${attachment.name} ---\n`
      )
    }
  }

  return `${message}\n\nUser has attached the following files. Please read and analyze their contents:\n${fileContents.join('\n')}`
}

