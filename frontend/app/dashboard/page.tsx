'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ChatLoadingSkeleton } from '@/components/chat/ChatLoadingSkeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load ChatInterface for better performance
const ChatInterface = dynamic(
  () => import('@/components/chat/ChatInterface').then(mod => ({ default: mod.ChatInterface })),
  {
    loading: () => <ChatLoadingSkeleton />,
    ssr: false,
  }
);

function ChatInterfaceWrapper() {
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get('session');
  
  return (
    <div className="h-full">
      <ChatInterface urlSessionId={urlSessionId} />
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <div className="relative inline-block mb-6">
        <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 animate-pulse" />
        <div className="relative w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
          <span className="text-white text-3xl font-bold">F</span>
        </div>
      </div>
      <Skeleton className="h-8 w-48 mb-3" />
      <Skeleton className="h-4 w-64 mb-6" />
      <div className="flex flex-wrap gap-3 justify-center">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-48 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ChatInterfaceWrapper />
    </Suspense>
  );
}

