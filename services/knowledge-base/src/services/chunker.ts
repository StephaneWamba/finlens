/**
 * Text Chunking Service
 * Splits text into chunks for vector embedding
 */

import { createLogger } from '@syntera/shared/logger/index.js'

const logger = createLogger('knowledge-base-service:chunker')

export interface TextChunk {
  text: string
  index: number
  startIndex: number
  endIndex: number
}

const DEFAULT_CHUNK_SIZE = 1000 // characters
const DEFAULT_CHUNK_OVERLAP = 200 // characters

/**
 * Split text into chunks with overlap
 */
export function chunkText(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  chunkOverlap: number = DEFAULT_CHUNK_OVERLAP
): TextChunk[] {
  if (text.length <= chunkSize) {
    return [
      {
        text,
        index: 0,
        startIndex: 0,
        endIndex: text.length,
      },
    ]
  }

  const chunks: TextChunk[] = []
  let startIndex = 0
  let chunkIndex = 0

  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + chunkSize, text.length)

    // Try to break at sentence boundary
    if (endIndex < text.length) {
      const sentenceEnd = findSentenceBoundary(text, endIndex)
      if (sentenceEnd > startIndex) {
        endIndex = sentenceEnd
      }
    }

    const chunkText = text.slice(startIndex, endIndex).trim()

    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index: chunkIndex,
        startIndex,
        endIndex,
      })
      chunkIndex++
    }

    // Move start index forward with overlap
    startIndex = endIndex - chunkOverlap
    if (startIndex < 0) startIndex = 0
  }

  return chunks
}

/**
 * Find the nearest sentence boundary around the given index
 */
function findSentenceBoundary(text: string, index: number): number {
  const sentenceEndings = ['. ', '.\n', '! ', '!\n', '? ', '?\n']
  let bestIndex = index

  // Look backwards
  for (let i = index; i > index - 100 && i >= 0; i--) {
    for (const ending of sentenceEndings) {
      if (text.slice(i, i + ending.length) === ending) {
        return i + ending.length
      }
    }
  }

  // Look forwards
  for (let i = index; i < index + 100 && i < text.length; i++) {
    for (const ending of sentenceEndings) {
      if (text.slice(i, i + ending.length) === ending) {
        return i + ending.length
      }
    }
  }

  return bestIndex
}


