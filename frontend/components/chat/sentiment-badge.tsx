'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Smile, Frown, Meh, Zap } from 'lucide-react'

interface SentimentBadgeProps {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  score?: number
  className?: string
}

export function SentimentBadge({ sentiment, score, className }: SentimentBadgeProps) {
  const variants = {
    positive: {
      icon: Smile,
      label: 'Positive',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    negative: {
      icon: Frown,
      label: 'Negative',
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    },
    neutral: {
      icon: Meh,
      label: 'Neutral',
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    },
    mixed: {
      icon: Zap,
      label: 'Mixed',
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    },
  }

  const variant = variants[sentiment]
  const Icon = variant.icon

  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 text-xs', variant.className, className)}
    >
      <Icon className="h-3 w-3" />
      <span>{variant.label}</span>
      {score !== undefined && (
        <span className="opacity-70">({score > 0 ? '+' : ''}{score.toFixed(1)})</span>
      )}
    </Badge>
  )
}



