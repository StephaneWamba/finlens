/**
 * Text Extraction Service
 * Extracts text from various file formats
 */

import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('knowledge-base-service:extractor')

export interface ExtractedText {
  text: string
  metadata: {
    pageCount?: number
    wordCount?: number
    characterCount?: number
  }
}

/**
 * Extract text from a file buffer based on MIME type
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedText> {
  try {
    switch (mimeType) {
      case 'application/pdf':
        return await extractFromPDF(buffer)
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await extractFromWord(buffer)
      case 'text/plain':
      case 'text/markdown':
      case 'text/csv':
        return extractFromText(buffer)
      default:
        throw new Error(`Unsupported file type: ${mimeType}`)
    }
  } catch (error) {
    logger.error('Text extraction failed', { error, mimeType })
    throw error
  }
}

/**
 * Extract text from PDF
 */
async function extractFromPDF(buffer: Buffer): Promise<ExtractedText> {
  try {
    const data = await pdfParse(buffer)
    return {
      text: data.text,
      metadata: {
        pageCount: data.numpages,
        wordCount: data.text.split(/\s+/).length,
        characterCount: data.text.length,
      },
    }
  } catch (error) {
    logger.error('PDF extraction failed', { error })
    throw new Error('Failed to extract text from PDF')
  }
}

/**
 * Extract text from Word document
 */
async function extractFromWord(buffer: Buffer): Promise<ExtractedText> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value
    return {
      text,
      metadata: {
        wordCount: text.split(/\s+/).length,
        characterCount: text.length,
      },
    }
  } catch (error) {
    logger.error('Word document extraction failed', { error })
    throw new Error('Failed to extract text from Word document')
  }
}

/**
 * Extract text from plain text files
 */
function extractFromText(buffer: Buffer): ExtractedText {
  const text = buffer.toString('utf-8')
  return {
    text,
    metadata: {
      wordCount: text.split(/\s+/).length,
      characterCount: text.length,
    },
  }
}


