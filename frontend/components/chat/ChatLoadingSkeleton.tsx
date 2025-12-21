'use client';

/**
 * Chat Loading Skeleton
 * 
 * Loading state for chat interface
 */

import { Skeleton } from '@/components/ui/skeleton';

export function ChatLoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-4 py-8">
      {/* User message skeleton */}
      <div className="flex justify-end">
        <div className="max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 bg-gradient-to-br from-blue-600 to-blue-700">
          <Skeleton className="h-4 w-48 bg-blue-500/50" />
        </div>
      </div>
      {/* Assistant message skeleton */}
      <div className="flex justify-start">
        <div className="max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 bg-white border border-gray-200">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>
      </div>
      {/* Another user message skeleton */}
      <div className="flex justify-end">
        <div className="max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 bg-gradient-to-br from-blue-600 to-blue-700">
          <Skeleton className="h-4 w-32 bg-blue-500/50" />
        </div>
      </div>
      {/* Another assistant message skeleton */}
      <div className="flex justify-start">
        <div className="max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 bg-white border border-gray-200">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}

