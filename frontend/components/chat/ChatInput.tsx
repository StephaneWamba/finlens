'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  onCancel,
  isLoading = false,
  disabled = false,
  placeholder = 'Type your question about financial reports...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading && !disabled) {
      onSend(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200/80 bg-white/80 backdrop-blur-sm p-4 shadow-lg shadow-gray-900/5">
      <div className="flex items-end gap-3 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <label htmlFor="chat-input" className="sr-only">
            Chat message input
          </label>
          <Textarea
            id="chat-input"
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={1}
            aria-label="Type your question about financial reports"
            aria-describedby="chat-input-help chat-input-count"
            aria-invalid={false}
            className={cn(
              'min-h-[52px] max-h-[200px] resize-none pr-12 rounded-xl',
              'bg-gray-50/80 border-gray-200 focus:bg-white',
              'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
              'transition-all duration-200 text-sm leading-relaxed',
              'placeholder:text-gray-400'
            )}
          />
          {message.length > 0 && (
            <div 
              id="chat-input-count"
              className="absolute bottom-3 right-3 text-xs text-gray-400 font-medium"
              aria-live="polite"
              aria-atomic="true"
            >
              {message.length} characters
            </div>
          )}
        </div>
        {isLoading && onCancel ? (
          <Button
            type="button"
            onClick={onCancel}
            aria-label="Cancel request"
            className={cn(
              'h-[52px] w-[52px] p-0 rounded-xl',
              'bg-gradient-to-br from-red-600 to-red-700',
              'hover:from-red-700 hover:to-red-800',
              'shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40',
              'transition-all duration-200'
            )}
          >
            <X className="h-5 w-5 text-white" aria-hidden="true" />
            <span className="sr-only">Cancel</span>
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!message.trim() || isLoading || disabled}
            aria-label={isLoading ? 'Sending message' : 'Send message'}
            aria-busy={isLoading}
            className={cn(
              'h-[52px] w-[52px] p-0 rounded-xl',
              'bg-gradient-to-br from-blue-600 to-blue-700',
              'hover:from-blue-700 hover:to-blue-800',
              'shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
              'transition-all duration-200'
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden="true" />
                <span className="sr-only">Sending</span>
              </>
            ) : (
              <>
                <Send className="h-5 w-5 text-white" aria-hidden="true" />
                <span className="sr-only">Send</span>
              </>
            )}
          </Button>
        )}
      </div>
      <p id="chat-input-help" className="text-xs text-gray-400 text-center mt-3">
        Press <kbd className="px-2 py-0.5 bg-gray-100 rounded-md text-xs font-medium border border-gray-200">Enter</kbd> to send,
        <kbd className="px-2 py-0.5 bg-gray-100 rounded-md text-xs font-medium border border-gray-200 ml-1.5">Shift + Enter</kbd> for new line
      </p>
    </form>
  );
}

