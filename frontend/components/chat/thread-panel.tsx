'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, MessageSquare, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatSocket } from '@/lib/api/chat'
import { toast } from 'sonner'

interface Thread {
  id: string
  title: string
  created_at: string
  message_count?: number
}

interface ThreadPanelProps {
  conversationId: string
  threads?: Thread[]
  currentThreadId?: string | null
  onThreadSelect: (threadId: string | null) => void
  token: string | null
}

export function ThreadPanel({
  conversationId,
  threads = [],
  currentThreadId,
  onThreadSelect,
  token,
}: ThreadPanelProps) {
  const [isCreatingThread, setIsCreatingThread] = useState(false)
  const [newThreadTitle, setNewThreadTitle] = useState('')
  const { socket } = useChatSocket(token)

  const handleCreateThread = () => {
    if (!newThreadTitle.trim()) {
      toast.error('Please enter a thread title')
      return
    }

    if (!socket) {
      toast.error('Not connected. Please wait...')
      return
    }

    socket.emit('thread:create', {
      conversationId,
      title: newThreadTitle.trim(),
    })

    setNewThreadTitle('')
    setIsCreatingThread(false)
    toast.success('Thread created')
  }

  const handleSwitchThread = (threadId: string | null) => {
    if (!socket) {
      toast.error('Not connected. Please wait...')
      return
    }

    // For main thread (null), emit with null threadId
    if (threadId === null) {
      socket.emit('thread:switch', {
        conversationId,
        threadId: null,
      })
    } else {
      socket.emit('thread:switch', {
        conversationId,
        threadId,
      })
    }

    onThreadSelect(threadId)
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Threads</CardTitle>
          <Dialog open={isCreatingThread} onOpenChange={setIsCreatingThread}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Thread</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="thread-title">Thread Title</Label>
                  <Input
                    id="thread-title"
                    value={newThreadTitle}
                    onChange={(e) => setNewThreadTitle(e.target.value)}
                    placeholder="e.g., Pricing Discussion"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateThread()
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreatingThread(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateThread}>Create</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <Button
          variant={currentThreadId === null ? 'default' : 'ghost'}
          className={cn(
            'w-full justify-start h-auto py-2 px-2',
            currentThreadId === null && 'bg-primary text-primary-foreground'
          )}
          onClick={() => handleSwitchThread(null)}
        >
          <MessageSquare className="h-4 w-4 mr-2 shrink-0" />
          <span className="text-sm">Main Thread</span>
        </Button>
        {threads.map((thread) => (
          <Button
            key={thread.id}
            variant={currentThreadId === thread.id ? 'default' : 'ghost'}
            className={cn(
              'w-full justify-start h-auto py-2 px-2',
              currentThreadId === thread.id && 'bg-primary text-primary-foreground'
            )}
            onClick={() => handleSwitchThread(thread.id)}
          >
            <MessageSquare className="h-4 w-4 mr-2 shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm truncate">{thread.title}</p>
              {thread.message_count !== undefined && (
                <p className="text-xs opacity-70">{thread.message_count} messages</p>
              )}
            </div>
          </Button>
        ))}
        {threads.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No threads yet. Create one to organize your conversation.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

