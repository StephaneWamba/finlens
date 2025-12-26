'use client';

/**
 * Chat Welcome Screen
 * 
 * Displays welcome message and example queries when chat is empty
 */

interface ChatWelcomeProps {
  readonly onExampleClick: (query: string) => void;
}

const EXAMPLE_QUERIES = [
  "What was Apple's revenue in 2022?",
  "Compare Tesla and Nvidia revenue",
  "Show me Amazon's profit margins",
];

export function ChatWelcome({ onExampleClick }: ChatWelcomeProps) {
  return (
    <div className="text-center py-16 px-4">
      <div className="relative inline-block mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl blur-xl opacity-20 animate-pulse" />
        <div className="relative w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
          <span className="text-white text-3xl font-bold">F</span>
        </div>
      </div>
      <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-3">
        Welcome to FinLens
      </h2>
      <p className="text-gray-600 mb-8 max-w-md mx-auto text-base leading-relaxed">
        Ask me anything about financial reports. I can help you analyze
        revenue, compare companies, and visualize data with beautiful charts.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        {EXAMPLE_QUERIES.map((example) => (
          <button
            key={example}
            onClick={() => onExampleClick(example.replaceAll('"', ''))}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
          >
            &quot;{example}&quot;
          </button>
        ))}
      </div>
    </div>
  );
}

