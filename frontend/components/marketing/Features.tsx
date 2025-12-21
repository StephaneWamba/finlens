'use client';

import { Brain, BarChart3, Building2, Zap, Shield, TrendingUp } from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'Smart Analysis',
    description: 'Advanced AI understands your financial questions and delivers precise answers',
  },
  {
    icon: BarChart3,
    title: 'Visual Insights',
    description: 'Beautiful charts and tables that make complex data easy to understand',
  },
  {
    icon: Building2,
    title: 'Unlimited Documents',
    description: 'Upload any number of financial documents. No limits on your document library',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Get answers in seconds, not hours. No more manual spreadsheet work',
  },
  {
    icon: Shield,
    title: 'Conversational',
    description: 'Ask follow-up questions naturally. FinLens remembers your conversation',
  },
  {
    icon: TrendingUp,
    title: 'Cross-Document Analysis',
    description: 'Compare metrics, identify trends, and analyze patterns across all your documents',
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-white overflow-hidden">
      {/* Very Visible Grid Background Pattern */}
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(59, 130, 246) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(59, 130, 246) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
      
      {/* Dramatic gradient overlays for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 via-transparent to-blue-100/80" />
      <div className="absolute inset-0 bg-gradient-to-tr from-white/50 via-transparent to-white/50" />
      
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
            Powerful Features
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Everything you need to analyze financial reports with AI precision
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative bg-white rounded-2xl border-2 border-gray-200 p-8 hover:border-blue-400 hover:-translate-y-2 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_20px_60px_rgb(59,130,246,0.3)]"
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 via-blue-500/0 to-blue-600/0 group-hover:from-blue-400/5 group-hover:via-blue-500/5 group-hover:to-blue-600/10 rounded-2xl transition-all duration-300" />
                
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-2xl group-hover:shadow-blue-500/50 group-hover:scale-110 transition-all duration-300">
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                    {feature.title}
                  </h3>
                  
                  <p className="text-base text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

