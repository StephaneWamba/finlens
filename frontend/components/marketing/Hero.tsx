'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Grid Background with Bigger Squares */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgb(59, 130, 246) 1px, transparent 1px),
            linear-gradient(to bottom, rgb(59, 130, 246) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
      
      {/* Gradient overlays for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/60 via-white/80 to-blue-50/60" />
      
      {/* Side Shadows - Left and Right */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-gray-900/10 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-gray-900/10 to-transparent" />
      
      <div className="container mx-auto max-w-4xl text-center relative z-10">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
          Turn Unstructured Financial Data Into
          <br />
          <span className="text-blue-600">Actionable Insights</span>
        </h1>
        
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Built for financial analysts. Stop spending hours digging through documents. Ask questions in plain English and get instant answers with beautiful visualizations.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link href="/auth/signup">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg">
              Start Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="px-8 py-6 text-lg">
            Watch Demo
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            <span>10 free queries</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            <span>No credit card</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            <span>2 min setup</span>
          </div>
        </div>

        {/* Dashboard Preview Placeholder */}
        <div className="mt-16 rounded-lg border border-gray-200 shadow-2xl overflow-hidden bg-white">
          <div className="aspect-video bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <span className="text-white text-2xl font-bold">F</span>
              </div>
              <p className="text-gray-600">Dashboard Preview</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

