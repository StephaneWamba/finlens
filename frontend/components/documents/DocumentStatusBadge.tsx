'use client';

import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { DocumentStatus } from '@/types/api';
import { cn } from '@/lib/utils';

interface DocumentStatusBadgeProps {
  readonly status: DocumentStatus;
  readonly className?: string;
}

const statusConfig: Record<
  DocumentStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }
> = {
  uploaded: {
    label: 'Uploaded',
    variant: 'secondary',
    className: 'bg-gray-100 text-gray-700 border-gray-300',
  },
  validating: {
    label: 'Validating',
    variant: 'secondary',
    className: 'bg-blue-100 text-blue-700 border-blue-300',
  },
  indexed: {
    label: 'Indexed',
    variant: 'default',
    className: 'bg-green-100 text-green-700 border-green-300',
  },
  failed: {
    label: 'Failed',
    variant: 'destructive',
    className: 'bg-red-100 text-red-700 border-red-300',
  },
};

export function DocumentStatusBadge({ status, className }: DocumentStatusBadgeProps) {
  const config = statusConfig[status];
  const isProcessing = ['validating'].includes(status);

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className, 'flex items-center gap-1.5')}
    >
      {isProcessing && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
      <span>{config.label}</span>
    </Badge>
  );
}

