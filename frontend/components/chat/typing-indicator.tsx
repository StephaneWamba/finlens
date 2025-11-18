'use client'

import { cn } from '@/lib/utils'

interface TypingIndicatorProps {
  isVisible: boolean
  userName?: string
}

export function TypingIndicator({ isVisible, userName }: TypingIndicatorProps) {
  if (!isVisible) return null

  return (
    <div className="flex gap-3 mb-4">
      <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
        <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
      </div>
      <div className="flex-1">
        <div className="rounded-lg px-4 py-2 bg-primary/10 inline-block">
          <div className="flex gap-1">
            <div className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
        {userName && (
          <span className="text-xs text-muted-foreground mt-1 block">{userName} is typing...</span>
        )}
      </div>
    </div>
  )
}


