'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { Bot, User, Sparkles, Download, Smile, CheckCheck } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { getFileIcon, getFileIconColor } from '@/lib/utils/file-icons'
import { useUpdateMessage } from '@/lib/api/chat'
import { createClient } from '@/lib/supabase/client'
import type { Message } from '@/lib/api/chat'
import type { EmojiClickData } from 'emoji-picker-react'
import { SentimentBadge } from './sentiment-badge'
import { IntentBadge } from './intent-badge'

// Lazy load markdown renderer (heavy component)
const ReactMarkdown = dynamic(() => import('react-markdown'), {
  ssr: false,
  loading: () => <div className="animate-pulse">Loading...</div>,
})

// Lazy load emoji picker (heavy component)
const EmojiPicker = dynamic(
  () => import('emoji-picker-react').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <div className="h-[400px] w-[300px] flex items-center justify-center">Loading emoji picker...</div>,
  }
)

// Import remark-gfm separately (smaller, can be loaded normally)
import remarkGfm from 'remark-gfm'

interface MessageBubbleProps {
  message: Message
  conversationId: string
  isOwn?: boolean
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export function MessageBubble({ message, conversationId, isOwn = false }: MessageBubbleProps) {
  const { theme } = useTheme()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const updateMessage = useUpdateMessage()
  const isAgent = message.sender_type === 'agent'
  const isSystem = message.sender_type === 'system'
  const hasMarkedAsReadRef = useRef(false) // Track if we've already marked this message as read
  
  const reactions = message.metadata?.reactions || []
  
  useEffect(() => {
    async function getUserId() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)
    }
    getUserId()
  }, [])

  const handleReaction = (emoji: string) => {
    if (!currentUserId) return
    
    // Skip if message ID is temporary (optimistic update)
    if (message._id.startsWith('temp-')) {
      return
    }
    
    const userReaction = reactions.find((r) => r.user_id === currentUserId && r.emoji === emoji)
    updateMessage.mutate({
      conversationId,
      messageId: message._id,
      data: { reaction: userReaction ? null : emoji },
    })
    setShowReactionPicker(false)
  }

  const getReactionCounts = () => {
    const counts: Record<string, number> = {}
    reactions.forEach((r) => {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1
    })
    return counts
  }

  const reactionCounts = getReactionCounts()
  
  // Auto-mark as read when message is viewed (for user's own messages)
  // Use ref to prevent multiple calls even if component re-renders
  useEffect(() => {
    // Reset ref if message already has read_at (in case message object changes)
    if (message.metadata?.read_at) {
      hasMarkedAsReadRef.current = true
      return
    }
    
    // Only mark as read once per message, even if component re-renders
    // Skip if message ID is temporary (optimistic update)
    if (isOwn && !hasMarkedAsReadRef.current && currentUserId && !message._id.startsWith('temp-')) {
      hasMarkedAsReadRef.current = true // Set immediately to prevent duplicate calls
      
      // Debounce: wait 3 seconds before marking as read
      const timer = setTimeout(() => {
        updateMessage.mutate({
          conversationId,
          messageId: message._id,
          data: { markAsRead: true },
        })
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [isOwn, message._id, currentUserId, conversationId])

  return (
    <div
      className={cn(
        'flex gap-3 mb-6 group',
        isOwn && 'flex-row-reverse'
      )}
    >
      <Avatar
        className={cn(
          'h-9 w-9 shrink-0 border-2',
          isAgent
            ? 'border-primary/30 bg-primary/10'
            : isSystem
            ? 'border-muted bg-muted'
            : 'border-primary/20 bg-accent'
        )}
      >
        <AvatarFallback
          className={cn(
            isAgent
              ? 'bg-primary/20 text-primary'
              : isSystem
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary/85 dark:bg-primary/75 text-primary-foreground/90 dark:text-primary-foreground/95'
          )}
        >
          {isAgent ? (
            <Bot className="h-4 w-4" />
          ) : (
            <User className="h-4 w-4" />
          )}
        </AvatarFallback>
      </Avatar>
      <div className={cn('flex-1 min-w-0 flex flex-col', isOwn && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 max-w-[85%] sm:max-w-[75%] w-full shadow-sm transition-all',
            isAgent
              ? 'bg-muted/50 border border-border/50 text-foreground'
              : isSystem
              ? 'bg-muted/30 border border-border/30 text-muted-foreground'
              : isOwn
              ? 'bg-blue-600 dark:bg-blue-700 text-white shadow-md'
              : 'bg-accent text-accent-foreground border border-border/50'
          )}
        >
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-3 space-y-2">
              {message.attachments.map((attachment, index) => {
                const isImage = attachment.type.startsWith('image/')
                const FileIcon = getFileIcon(attachment.name)
                const fileColor = getFileIconColor(attachment.name)
                
                return (
                  <div key={index} className="rounded-lg overflow-hidden border border-border/50">
                    {isImage ? (
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block relative"
                      >
                        <Image
                          src={attachment.url}
                          alt={attachment.name}
                          width={800}
                          height={600}
                          className="max-w-full max-h-[300px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          unoptimized
                        />
                      </a>
                    ) : (
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={attachment.name}
                        className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className={cn('p-2 rounded-lg bg-muted/50', fileColor)}>
                          <FileIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{attachment.name}</p>
                          {attachment.size && (
                            <p className="text-xs text-muted-foreground">
                              {(attachment.size / 1024).toFixed(1)} KB
                            </p>
                          )}
                        </div>
                        <Download className="h-4 w-4 text-muted-foreground shrink-0" />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          
          {/* Message Content */}
          {message.content && (
            <div className="text-sm leading-relaxed break-words markdown-content">
              <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Headings
                h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1">{children}</h3>,
                // Paragraphs
                p: ({ children }) => <p className="my-2 break-words whitespace-pre-wrap">{children}</p>,
                // Lists
                ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1 ml-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1 ml-2">{children}</ol>,
                li: ({ children }) => <li className="break-words">{children}</li>,
                // Code blocks
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '')
                  const isInline = !match
                  return isInline ? (
                    <code className="bg-muted/70 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                },
                pre: ({ children }) => (
                  <pre className="bg-muted/50 p-3 rounded-lg overflow-x-auto my-2 text-xs font-mono">
                    {children}
                  </pre>
                ),
                // Blockquotes
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary/30 pl-4 italic my-2 text-muted-foreground">
                    {children}
                  </blockquote>
                ),
                // Links - use softer colors in user messages
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      isOwn 
                        ? 'text-primary-foreground/90 dark:text-primary-foreground underline hover:text-primary-foreground'
                        : 'text-primary underline hover:text-primary/80'
                    )}
                  >
                    {children}
                  </a>
                ),
                // Text formatting
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                // Horizontal rule
                hr: () => <hr className="my-4 border-border" />,
                // Tables
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="w-full border-collapse border border-border">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
                tbody: ({ children }) => <tbody>{children}</tbody>,
                tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
                th: ({ children }) => (
                  <th className="border border-border p-2 text-left font-semibold">{children}</th>
                ),
                td: ({ children }) => <td className="border border-border p-2">{children}</td>,
              }}
            >
              {message.content}
            </ReactMarkdown>
            </div>
          )}
          {/* AI Metadata, Intent, and Sentiment */}
          {(message.ai_metadata || message.metadata?.intent || message.metadata?.sentiment) && (
            <div className="mt-3 pt-2 flex flex-wrap gap-1.5 border-t border-border/50">
              {message.metadata?.intent?.category && (
                <IntentBadge
                  intent={message.metadata.intent.category as 'question' | 'complaint' | 'request' | 'purchase' | 'support' | 'feedback' | 'greeting' | 'goodbye' | 'other'}
                  confidence={message.metadata.intent.confidence}
                />
              )}
              {message.metadata?.sentiment && (
                <SentimentBadge
                  sentiment={message.metadata.sentiment.sentiment}
                  score={message.metadata.sentiment.score}
                />
              )}
              {message.ai_metadata?.model && (
                <Badge variant="secondary" className="text-xs font-normal">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {message.ai_metadata.model}
                </Badge>
              )}
              {message.ai_metadata?.tokens_used && (
                <Badge variant="outline" className="text-xs font-normal">
                  {message.ai_metadata.tokens_used} tokens
                </Badge>
              )}
            </div>
          )}
          
          {/* Reactions */}
          {reactions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(reactionCounts).map(([emoji, count]) => {
                const isUserReaction = reactions.some(
                  (r) => r.user_id === currentUserId && r.emoji === emoji
                )
                return (
                  <Button
                    key={emoji}
                    variant={isUserReaction ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      'h-6 px-2 text-xs',
                      isUserReaction && 'bg-primary/20 border-primary/30'
                    )}
                    onClick={() => handleReaction(emoji)}
                  >
                    <span>{emoji}</span>
                    <span className="ml-1">{count}</span>
                  </Button>
                )
              })}
            </div>
          )}
          
          {/* Reaction Button */}
          <div className="mt-2 flex items-center gap-2">
            <Popover open={showReactionPicker} onOpenChange={setShowReactionPicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Smile className="h-3 w-3 mr-1" />
                  {reactions.length === 0 ? 'Add reaction' : 'React'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1">
                    {QUICK_REACTIONS.map((emoji) => (
                      <Button
                        key={emoji}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-lg"
                        onClick={() => handleReaction(emoji)}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                  <div className="border-t pt-2">
                    <EmojiPicker
                      onEmojiClick={(data: EmojiClickData) => handleReaction(data.emoji)}
                      autoFocusSearch={false}
                      width={300}
                      // @ts-ignore - emoji-picker-react theme prop works but types are strict
                      theme={theme === 'dark' ? 'dark' : 'light'}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            {/* Read Receipt */}
            {isOwn && message.metadata?.read_at && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCheck className="h-3 w-3 text-primary" />
                <span>Read</span>
              </div>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-foreground mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  )
}