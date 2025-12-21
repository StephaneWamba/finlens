'use client';

import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChartRenderer } from '@/components/charts/ChartRenderer';
import { SourcesToggle } from './SourcesToggle';
import type { ChartData } from '@/types/api';

interface MessageBubbleProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
    charts?: ChartData[];
    sources?: Array<{ company: string; year: number; page: number }>;
  };
}

// Helper function to render content with chart placeholders replaced
function renderContentWithCharts(content: string, charts: ChartData[]) {
  // Split content by chart placeholders
  const parts: Array<{ type: 'text' | 'chart'; content?: string; chartIndex?: number }> = [];
  const chartPlaceholderRegex = /\[CHART:(\d+)\]/g;
  let lastIndex = 0;
  let match;
  let chartIndex = 0;

  while ((match = chartPlaceholderRegex.exec(content)) !== null) {
    // Add text before placeholder
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex, match.index),
      });
    }
    
    // Add chart
    const placeholderNum = parseInt(match[1], 10);
    if (chartIndex < charts.length) {
      parts.push({
        type: 'chart',
        chartIndex: chartIndex,
      });
      chartIndex++;
    } else {
      // Chart not available, show placeholder text
      parts.push({
        type: 'text',
        content: `[Chart ${placeholderNum}]`,
      });
    }
    
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.substring(lastIndex),
    });
  }

  // If no placeholders found, just render the content
  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'chart' && part.chartIndex !== undefined && charts[part.chartIndex]) {
          return (
            <div
              key={`chart-${index}`}
              className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border border-gray-200/80 shadow-sm my-4"
            >
              <ChartRenderer chart={charts[part.chartIndex]} />
            </div>
          );
        } else if (part.content) {
          return (
            <ReactMarkdown
              key={`text-${index}`}
              remarkPlugins={[remarkGfm]}
              components={{
                // Style markdown elements with improved typography
                p: ({ children }) => (
                  <p className="mb-2.5 last:mb-0 text-[13px] leading-relaxed text-gray-800 font-normal">
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold text-gray-900 text-[13px]">
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-gray-700">{children}</em>
                ),
                h1: ({ children }) => (
                  <h1 className="text-base font-bold mb-2 mt-4 first:mt-0 text-gray-900">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-sm font-bold mb-2 mt-3 first:mt-0 text-gray-900">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-[13px] font-semibold mb-1.5 mt-2 first:mt-0 text-gray-900">
                    {children}
                  </h3>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside mb-2.5 space-y-1 text-[13px]">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside mb-2.5 space-y-1 text-[13px]">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-[13px] leading-relaxed">{children}</li>
                ),
                code: ({ inline, children, ...props }: { inline?: boolean; children?: React.ReactNode; [key: string]: any }) => {
                  if (inline) {
                    return (
                      <code
                        className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold border border-blue-200"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code
                      className="block bg-gray-50 text-gray-800 p-2.5 rounded-md text-[11px] font-mono overflow-x-auto border border-gray-200"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3 rounded-lg border border-gray-200">
                    <table className="min-w-full border-collapse text-[12px]">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">{children}</thead>
                ),
                tbody: ({ children }) => <tbody className="bg-white">{children}</tbody>,
                tr: ({ children }) => (
                  <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    {children}
                  </tr>
                ),
                th: ({ children }) => (
                  <th className="border-r border-gray-200 px-3 py-2 text-left font-semibold text-gray-900 last:border-r-0">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border-r border-gray-200 px-3 py-2 text-gray-700 last:border-r-0">
                    {children}
                  </td>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-400 bg-blue-50/50 pl-4 py-2 italic my-3 rounded-r text-[13px] text-gray-700">
                    {children}
                  </blockquote>
                ),
                text: ({ children }) => {
                  return <>{children}</>;
                },
              }}
            >
              {part.content}
            </ReactMarkdown>
          );
        }
        return null;
      })}
    </>
  );
}

export const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex w-full mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3.5 shadow-sm',
          isUser
            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-blue-500/20'
            : 'bg-white text-gray-900 border border-gray-200/80 shadow-gray-200/50'
        )}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words font-medium">
            {message.content}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="prose prose-sm max-w-none dark:prose-invert markdown-content">
              {renderContentWithCharts(message.content, message.charts || [])}
            </div>

            {/* Toggleable sources */}
            {message.sources && message.sources.length > 0 && (
              <SourcesToggle sources={message.sources} />
            )}
          </div>
        )}
      </div>
    </div>
  );
});

