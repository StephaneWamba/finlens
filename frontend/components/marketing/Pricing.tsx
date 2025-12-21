'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for trying out FinLens',
    features: [
      '10 queries per month',
      'Basic support',
      'All core features',
    ],
    cta: 'Try Free',
    href: '/auth/signup',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    description: 'For professionals and teams',
    features: [
      '500 queries per month',
      'Priority support',
      'All core features',
      'Advanced analytics',
    ],
    cta: 'Subscribe',
    href: '/auth/signup',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '$99',
    period: '/month',
    description: 'For large organizations',
    features: [
      'Unlimited queries',
      'Dedicated support',
      'All features',
      'Custom integrations',
    ],
    cta: 'Contact Sales',
    href: '/contact',
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 overflow-hidden">
      {/* Very Visible Grid Background Pattern */}
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
      
      {/* Dramatic gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/60 via-white/80 to-blue-50/60" />
      <div className="absolute inset-0 bg-gradient-to-tr from-white/40 via-transparent to-white/40" />
      
      <div className="container mx-auto max-w-6xl relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Choose the plan that works for you
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative bg-white/90 backdrop-blur-sm border-2 transition-all duration-500 group rounded-2xl flex flex-col ${
                plan.popular
                  ? 'border-blue-500 shadow-2xl scale-105 ring-2 ring-blue-200/50 hover:scale-110 overflow-visible'
                  : 'border-gray-200/60 hover:border-blue-300/60 hover:shadow-2xl hover:-translate-y-1 overflow-hidden'
              }`}
              style={{
                boxShadow: plan.popular 
                  ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(37, 99, 235, 0.1)'
                  : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              }}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-xl px-4 py-1 text-sm font-semibold z-50">
                  POPULAR
                </Badge>
              )}
              
              {/* Enhanced gradient overlay for popular plan */}
              {plan.popular && (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 via-blue-50/20 to-transparent pointer-events-none" />
              )}
              
              {/* Subtle border glow */}
              <div className={`absolute inset-0 rounded-2xl border-2 border-transparent transition-colors duration-500 pointer-events-none ${
                plan.popular ? 'group-hover:border-blue-300/60' : 'group-hover:border-blue-200/50'
              }`} />
              
              <CardHeader className="relative z-10 pt-8 pb-6 px-6">
                <CardTitle className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</CardTitle>
                <CardDescription className="text-gray-600 leading-relaxed">{plan.description}</CardDescription>
                <div className="mt-6">
                  <span className="text-5xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-600 ml-1 text-lg">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 px-6 pb-6 flex-grow">
                <ul className="space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                        <Check className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="text-gray-700 leading-relaxed text-base">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="relative z-10 px-6 pb-8 mt-auto">
                <Link href={plan.href} className="w-full">
                  <Button
                    className={`w-full h-12 text-base font-semibold transition-all duration-300 rounded-xl ${
                      plan.popular
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl hover:scale-105'
                        : 'bg-gray-900 hover:bg-gray-800 text-white shadow-md hover:shadow-lg hover:scale-105'
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

