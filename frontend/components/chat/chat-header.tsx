/**
 * Chat Header Component
 * Displays agent info, connection status, and search functionality
 */

'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Bot, Wifi, WifiOff, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Agent } from '@/lib/api/agents'

interface ChatHeaderProps {
  agent?: Agent
  isConnected: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  searchResultsCount?: number
}

export function ChatHeader({ agent, isConnected, searchQuery, onSearchChange, searchResultsCount }: ChatHeaderProps) {
  const [showSearch, setShowSearch] = useState(false)

  return (
    <div className="px-6 py-4 border-b bg-muted/30">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{agent?.name || 'AI Agent'}</h3>
            {agent?.model && (
              <p className="text-xs text-muted-foreground">{agent.model}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Badge
            variant={isConnected ? 'default' : 'secondary'}
            className={cn(
              'gap-1.5',
              isConnected && 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
            )}
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                Connected
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Connecting...
              </>
            )}
          </Badge>
        </div>
      </div>
      {showSearch && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => onSearchChange('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          {searchQuery && searchResultsCount !== undefined && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {searchResultsCount} result{searchResultsCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  )
}