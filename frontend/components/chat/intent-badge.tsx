'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { HelpCircle, AlertCircle, ShoppingCart, MessageCircle, Heart, Hand, LogOut, MoreHorizontal } from 'lucide-react'

interface IntentBadgeProps {
  intent: 'question' | 'complaint' | 'request' | 'purchase' | 'support' | 'feedback' | 'greeting' | 'goodbye' | 'other'
  confidence?: number
  className?: string
}

export function IntentBadge({ intent, confidence, className }: IntentBadgeProps) {
  const variants = {
    question: {
      icon: HelpCircle,
      label: 'Question',
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    complaint: {
      icon: AlertCircle,
      label: 'Complaint',
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    },
    request: {
      icon: MessageCircle,
      label: 'Request',
      className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    },
    purchase: {
      icon: ShoppingCart,
      label: 'Purchase',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    support: {
      icon: HelpCircle,
      label: 'Support',
      className: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    },
    feedback: {
      icon: Heart,
      label: 'Feedback',
      className: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    },
    greeting: {
      icon: Hand,
      label: 'Greeting',
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    },
    goodbye: {
      icon: LogOut,
      label: 'Goodbye',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    },
    other: {
      icon: MoreHorizontal,
      label: 'Other',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    },
  } as const

  // Fallback to 'other' if intent is invalid or undefined
  const validIntent = (intent && intent in variants) ? intent : 'other'
  const variant = variants[validIntent]
  const Icon = variant.icon

  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 text-xs', variant.className, className)}
    >
      <Icon className="h-3 w-3" />
      <span>{variant.label}</span>
      {confidence !== undefined && (
        <span className="opacity-70">({Math.round(confidence * 100)}%)</span>
      )}
    </Badge>
  )
}

