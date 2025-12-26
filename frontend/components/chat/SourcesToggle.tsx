'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Source {
  company: string;
  year: number;
  page: number;
}

interface SourcesToggleProps {
  readonly sources: Source[];
}

export function SourcesToggle({ sources }: SourcesToggleProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-gray-200 pt-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 h-auto py-1.5 px-2"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" />
          <span className="font-medium">
            {sources.length} {sources.length === 1 ? 'source' : 'sources'}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </Button>
      
      {isOpen && (
        <div className="mt-2 space-y-1.5 pl-6">
          {sources.map((source, index) => (
            <div
              key={`${source.company}-${source.year}-${source.page}-${index}`}
              className="text-xs text-gray-600 flex items-start gap-2"
            >
              <span className="text-gray-400 font-mono mt-0.5">•</span>
              <span>
                <span className="font-semibold text-gray-700">{source.company}</span>
                {' '}
                <span className="text-gray-600">{source.year}</span> Annual Report
                {source.page && (
                  <span className="text-gray-500">, Page {source.page}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

