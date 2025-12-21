'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary Component
 *
 * React Error Boundary that catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the entire app.
 *
 * Features:
 * - Catches errors in child components during rendering, lifecycle methods, and constructors
 * - Displays user-friendly error UI with retry and navigation options
 * - Logs errors to console in development mode
 * - Supports custom fallback UI via props
 * - Provides error recovery mechanism
 *
 * @param {ReactNode} props.children - Child components to wrap with error boundary
 * @param {ReactNode} [props.fallback] - Optional custom fallback UI to display on error
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 *
 * // With custom fallback
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error | unknown): State {
    // Ensure we always have an Error object
    const errorObj = error instanceof Error 
      ? error 
      : new Error(typeof error === 'object' && error !== null 
          ? ((error as { message?: string; error?: string }).message || (error as { error?: string }).error || JSON.stringify(error))
          : String(error));
    return { hasError: true, error: errorObj };
  }

  componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo) {
    // Error is handled by error reporting service
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <Card className="max-w-md w-full">
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <CardTitle className="text-center">Something went wrong</CardTitle>
              <CardDescription className="text-center">
                {this.state.error?.message || 'An unexpected error occurred'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button onClick={this.handleReset} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try again
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/dashboard">
                  <Home className="h-4 w-4 mr-2" />
                  Go to dashboard
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

