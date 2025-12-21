'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authService } from '@/lib/api/auth';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useErrorHandler } from '@/lib/utils/errorHandlerHelpers';
import { Skeleton } from '@/components/ui/skeleton';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handleError } = useErrorHandler();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for error in query params or hash
        const error = searchParams.get('error') || new URLSearchParams(window.location.hash.substring(1)).get('error');
        const errorDescription = searchParams.get('error_description') || new URLSearchParams(window.location.hash.substring(1)).get('error_description');
        
        if (error) {
          setStatus('error');
          setErrorMessage(errorDescription || error || 'Authentication failed');
          return;
        }

        // Check for code/state in query params (Supabase might redirect with these)
        const code = searchParams.get('code');
        const state = searchParams.get('state');

        // Supabase OAuth redirects with tokens in URL hash
        // Try to handle OAuth callback (will check hash first, then code/state)
        const result = await authService.handleOAuthCallback(code || undefined, state || undefined);

        if (result) {
          setStatus('success');
          // Redirect to dashboard immediately on success
          router.push('/dashboard');
        } else {
          // If no result, something went wrong
          setStatus('error');
          setErrorMessage('No authentication tokens found. Please try signing in again.');
        }
      } catch (error) {
        const apiError = handleError(error, {
          showToast: false,
          logContext: { action: 'oauth_callback' },
        });
        setStatus('error');
        setErrorMessage(apiError.message);
      }
    };

    handleCallback();
  }, [router, searchParams, handleError]);

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">F</span>
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-center">
          {status === 'loading' && 'Completing sign in...'}
          {status === 'success' && 'Sign in successful!'}
          {status === 'error' && 'Sign in failed'}
        </CardTitle>
        <CardDescription className="text-center">
          {status === 'loading' && 'Please wait while we complete your authentication'}
          {status === 'success' && 'Redirecting you to the dashboard...'}
          {status === 'error' && errorMessage}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center space-y-4 py-8">
        {status === 'loading' && (
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        )}
        {status === 'success' && (
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        )}
        {status === 'error' && (
          <>
            <XCircle className="h-8 w-8 text-red-600" />
            <div className="flex flex-col space-y-2 w-full">
              <Button
                onClick={() => router.push('/auth/signin')}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Try again
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/')}
                className="w-full"
              >
                Go to home
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <Card className="shadow-lg">
        <CardContent className="flex flex-col items-center justify-center space-y-4 py-8">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    }>
      <CallbackContent />
    </Suspense>
  );
}

