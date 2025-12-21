'use client';

/**
 * Standardized Loading Components
 * 
 * Reusable loading states for consistent UX across the application
 */

import { Skeleton } from './skeleton';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2 
      className={cn('animate-spin text-blue-600', sizeClasses[size], className)} 
      aria-label="Loading"
      aria-live="polite"
      role="status"
    />
  );
}

interface LoadingCardProps {
  lines?: number;
  showHeader?: boolean;
  className?: string;
}

export function LoadingCard({ lines = 3, showHeader = true, className }: LoadingCardProps) {
  return (
    <div 
      className={cn('rounded-xl border p-6 space-y-4', className)}
      aria-label="Loading content"
      role="status"
      aria-live="polite"
    >
      {showHeader && (
        <div className="space-y-2" aria-hidden="true">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      )}
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      <span className="sr-only">Loading content, please wait</span>
    </div>
  );
}

interface LoadingPageProps {
  message?: string;
  showSpinner?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function LoadingPage({ 
  message = 'Loading...', 
  showSpinner = true,
  action 
}: LoadingPageProps) {
  return (
    <div 
      className="flex flex-col items-center justify-center min-h-[400px] space-y-4"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      {showSpinner && <LoadingSpinner size="lg" />}
      <p className="text-sm text-gray-600">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label={action.label}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface LoadingInlineProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingInline({ text = 'Loading...', size = 'sm' }: LoadingInlineProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <LoadingSpinner size={size} />
      <span>{text}</span>
    </div>
  );
}

interface LoadingButtonProps {
  children: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

export function LoadingButton({ children, isLoading, className }: LoadingButtonProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isLoading && <LoadingSpinner size="sm" />}
      {children}
    </div>
  );
}

