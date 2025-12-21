'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Navbar } from '@/components/marketing/Navbar';
import { Footer } from '@/components/marketing/Footer';
import { SkipToMainContent } from '@/components/ui/SkipToMainContent';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load marketing components for better performance
const Hero = dynamic(() => import('@/components/marketing/Hero').then(mod => ({ default: mod.Hero })), {
  loading: () => <Skeleton className="h-96 w-full" />,
});

const Features = dynamic(() => import('@/components/marketing/Features').then(mod => ({ default: mod.Features })), {
  loading: () => <Skeleton className="h-96 w-full" />,
});

const Pricing = dynamic(() => import('@/components/marketing/Pricing').then(mod => ({ default: mod.Pricing })), {
  loading: () => <Skeleton className="h-96 w-full" />,
});

// Handle OAuth errors that might redirect to root
function OAuthErrorHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get('error');
    const errorCode = searchParams.get('error_code');
    const errorDescription = searchParams.get('error_description');

    // If OAuth error detected, redirect to callback page to handle it properly
    if (error && errorCode) {
      const params = new URLSearchParams();
      if (error) params.set('error', error);
      if (errorCode) params.set('error_code', errorCode);
      if (errorDescription) params.set('error_description', errorDescription);
      
      router.replace(`/auth/callback?${params.toString()}`);
    }
  }, [router, searchParams]);

  return null;
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Suspense fallback={null}>
        <OAuthErrorHandler />
      </Suspense>
      <SkipToMainContent />
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <Features />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
