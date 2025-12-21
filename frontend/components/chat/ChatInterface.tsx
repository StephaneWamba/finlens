'use client';

import { useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { ChatInput } from './ChatInput';
import { ChatWelcome } from './ChatWelcome';
import { ChatLoadingSkeleton } from './ChatLoadingSkeleton';
import { ChatMessageList } from './ChatMessageList';
import { useChatSession } from '@/lib/hooks/useChatSession';
import { useChatMessages } from '@/lib/hooks/useChatMessages';

interface ChatInterfaceProps {
  initialSessionId?: string;
  urlSessionId?: string | null;
}

/**Main chat interface component.*/
export const ChatInterface = memo(function ChatInterface({ initialSessionId, urlSessionId }: ChatInterfaceProps) {
  const { 
    loadSession: loadSessionFromHook, 
    loadMore: loadMoreMessages,
    isLoading: isLoadingSession,
    isLoadingMore: isLoadingMoreMessages,
    pagination
  } = useChatSession();
  const {
    messages,
    sessionId,
    isLoading,
    error,
    sendMessage: handleSend,
    cancelRequest,
    setMessages,
    setSessionId,
  } = useChatMessages(initialSessionId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // Use setTimeout to ensure DOM is ready
    const timer = setTimeout(() => {
      if (messagesEndRef.current) {
        try {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        } catch {
          // Silently handle scroll errors (element might not be in viewport)
        }
      }
    }, 0);
    
    return () => clearTimeout(timer);
  }, [messages]);

  // Load session if URL has session parameter
  useEffect(() => {
    if (urlSessionId) {
      // Only load if session ID changed or is different from current
      if (urlSessionId !== sessionId) {
        loadSessionFromHook(urlSessionId, 10, 0, false).then((loadedMessages) => {
          setMessages(loadedMessages);
          setSessionId(urlSessionId);
        });
      }
    } else if (!urlSessionId && sessionId) {
      // Clear messages if no session in URL (user clicked "New Chat")
      setMessages([]);
      setSessionId(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSessionId, loadSessionFromHook]); // Only depend on urlSessionId to reload when it changes

  // Handle "Load More" button click
  const handleLoadMore = useCallback(async () => {
    if (!sessionId || !pagination || isLoadingMoreMessages) return;
    
    const olderMessages = await loadMoreMessages(sessionId, pagination.offset);
    if (olderMessages.length > 0) {
      // Prepend older messages to the beginning of the list
      // Messages are already sorted chronologically from backend
      setMessages([...olderMessages, ...messages]);
    }
  }, [sessionId, pagination, isLoadingMoreMessages, loadMoreMessages, setMessages, messages]);

  // Trigger sidebar refresh after sending message
  useEffect(() => {
    if (sessionId && typeof window !== 'undefined') {
      // Dispatch event to trigger sidebar refetch when session changes
      window.dispatchEvent(new CustomEvent('session-updated'));
    }
  }, [sessionId]);

  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-4">
          {!hasMessages && !isLoading && !isLoadingSession && (
            <ChatWelcome onExampleClick={handleSend} />
          )}

          {(isLoading || isLoadingSession) && !hasMessages && (
            <ChatLoadingSkeleton />
          )}

          {hasMessages && (
            <ChatMessageList 
              messages={messages} 
              isLoading={isLoading}
              onLoadMore={handleLoadMore}
              hasMore={pagination?.has_more ?? false}
              isLoadingMore={isLoadingMoreMessages}
            />
          )}

          {error && !isLoading && (
            <div className="bg-gradient-to-r from-red-50 to-red-50/50 border border-red-200/80 rounded-xl p-4 text-sm text-red-700 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-start gap-2">
                <div className="w-1 h-full bg-red-500 rounded-full mt-0.5" />
                <div>
                  <p className="font-medium mb-1">Error</p>
                  <p className="text-red-600">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <ChatInput
        onSend={handleSend}
        onCancel={cancelRequest}
        isLoading={isLoading}
        disabled={!!error}
      />
    </div>
  );
});

