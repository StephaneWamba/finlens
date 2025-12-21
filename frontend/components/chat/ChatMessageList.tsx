'use client';

/**
 * Chat Message List
 * 
 * Displays list of chat messages
 */

import { MessageBubble } from './MessageBubble';
import { LoadingSpinner } from '@/components/ui/loading';
import type { ChartData } from '@/types/api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  charts?: ChartData[];
  sources?: Array<{ company: string; year: number; page: number }>;
}

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export function ChatMessageList({ 
  messages, 
  isLoading,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false
}: ChatMessageListProps) {
  return (
    <>
      {hasMore && onLoadMore && (
        <div className="flex justify-center mb-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoadingMore ? 'Loading...' : 'Load More Messages'}
          </button>
        </div>
      )}
      {messages.map((message, index) => (
        <MessageBubble key={index} message={message} />
      ))}
      {isLoading && (
        <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300 mb-4">
          <div className="max-w-[85%] md:max-w-[75%] bg-white border border-gray-200 rounded-2xl px-5 py-4 flex items-center gap-3 shadow-sm">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-blue-500 rounded-full blur-sm opacity-30 animate-pulse" />
              <LoadingSpinner size="sm" />
            </div>
            <div className="flex-1">
              <span className="text-sm text-gray-700 font-medium block">Analyzing your query...</span>
              <span className="text-xs text-gray-500 mt-0.5 block">This may take a few moments</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

