/**
 * Session and Message Types
 * 
 * Type definitions for chat sessions and messages
 */

import type { ChartData, Source } from './api';

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  text?: string;
  charts?: ChartData[] | ChartData;
  sources?: Source[] | Source;
  timestamp?: string;
  created_at?: string;
}

export interface Conversation {
  messages?: SessionMessage[];
  [key: string]: unknown;
}

export interface SessionData {
  session_id?: string;
  messages?: SessionMessage[];
  conversations?: Conversation[];
  [key: string]: unknown;
}

