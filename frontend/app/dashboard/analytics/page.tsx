'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { userService } from '@/lib/api/user';
import { queryKeys } from '@/lib/api/queryKeys';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingCard, LoadingPage } from '@/components/ui/loading';
import dynamic from 'next/dynamic';
import { format } from 'date-fns';
import { DollarSign, Activity, CheckCircle, XCircle, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  transformTrendChartData,
  transformCostChartData,
  formatCurrency,
  formatPercentage,
} from '@/lib/services/analyticsService';

// Lazy load chart components for better performance
const LineChart = dynamic(() => import('@/components/charts/LineChart').then(mod => ({ default: mod.LineChart })), {
  loading: () => <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 border-t-blue-600" /></div>,
  ssr: false,
});

const BarChart = dynamic(() => import('@/components/charts/BarChart').then(mod => ({ default: mod.BarChart })), {
  loading: () => <div className="h-64 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 border-t-blue-600" /></div>,
  ssr: false,
});

export default function AnalyticsPage() {
  // Optimize stale times: analytics data changes frequently, use shorter cache
  // Use cached data on navigation for instant page loads
  const { data: usageStats, isLoading: isLoadingUsage, isError: isErrorUsage } = useQuery({
    queryKey: queryKeys.user.usage(30),
    queryFn: () => userService.getUsage(30),
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds for analytics data
    gcTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
    refetchOnMount: false, // Use cached data if fresh - only refetch if stale
  });

  const { data: queryHistory, isLoading: isLoadingHistory, isError: isErrorHistory } = useQuery({
    queryKey: queryKeys.user.queryHistory(20),
    queryFn: () => userService.getQueryHistory(20),
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
    refetchOnMount: false, // Use cached data if fresh - only refetch if stale
  });

  const { data: trends, isLoading: isLoadingTrends, isError: isErrorTrends } = useQuery({
    queryKey: queryKeys.user.usageTrends(30),
    queryFn: () => userService.getUsageTrends(30),
    retry: 1,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
    refetchOnMount: false, // Use cached data if fresh - only refetch if stale
  });

  if (isLoadingUsage || isLoadingHistory || isLoadingTrends) {
    return (
      <div className="space-y-6 p-6">
        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <LoadingCard key={i} lines={2} showHeader={true} />
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LoadingCard lines={1} showHeader={true} className="h-64" />
          <LoadingCard lines={1} showHeader={true} className="h-64" />
        </div>

        {/* Query History Skeleton */}
        <LoadingCard lines={3} showHeader={true} />
      </div>
    );
  }

  if (isErrorUsage || isErrorHistory || isErrorTrends) {
    return (
      <LoadingPage 
        message="Failed to load analytics. Please try refreshing the page."
        showSpinner={false}
        action={{
          label: 'Refresh Page',
          onClick: () => window.location.reload(),
        }}
      />
    );
  }

  const periodStats = usageStats?.period_stats || {
    total_queries: 0,
    successful_queries: 0,
    failed_queries: 0,
    success_rate: 0,
    total_cost_usd: 0,
    average_cost_per_query: 0,
    total_tokens: 0,
    period_days: 30,
  };

  // Memoize chart data transformations for better performance
  const trendChartData = useMemo(() => transformTrendChartData(trends?.trends), [trends]);
  const costChartData = useMemo(() => transformCostChartData(trends?.trends), [trends]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-1">Track your usage and query performance</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
            <Activity className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{periodStats.total_queries}</div>
            <p className="text-xs text-gray-500 mt-1">Last {periodStats.period_days} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(periodStats.success_rate)}</div>
            <p className="text-xs text-gray-500 mt-1">
              {periodStats.successful_queries} successful / {periodStats.failed_queries} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(periodStats.total_cost_usd)}</div>
            <p className="text-xs text-gray-500 mt-1">
              {formatCurrency(periodStats.average_cost_per_query)} avg per query
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Zap className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {periodStats.total_tokens > 0
                ? periodStats.total_tokens >= 1000
                  ? `${(periodStats.total_tokens / 1000).toFixed(1)}K`
                  : periodStats.total_tokens.toLocaleString()
                : '0'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Tokens processed</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Query Trends</CardTitle>
            <CardDescription>Daily query volume over the last {periodStats.period_days} days</CardDescription>
          </CardHeader>
          <CardContent>
            {trendChartData ? (
              <div style={{ height: '300px' }}>
                <LineChart data={trendChartData} />
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Cost</CardTitle>
            <CardDescription>Cost per day over the last {periodStats.period_days} days</CardDescription>
          </CardHeader>
          <CardContent>
            {costChartData ? (
              <div style={{ height: '300px' }}>
                <BarChart data={costChartData} />
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Query History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Queries</CardTitle>
          <CardDescription>Your most recent query history</CardDescription>
        </CardHeader>
        <CardContent>
          {queryHistory?.queries && queryHistory.queries.length > 0 ? (
            <div className="space-y-3">
              {queryHistory.queries.map((query) => (
                <div
                  key={query.id}
                  className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{query.query_text}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-500">
                        {format(new Date(query.created_at), 'MMM dd, yyyy HH:mm')}
                      </span>
                      <span className="text-xs text-gray-500">
                        {query.tokens_used.toLocaleString()} tokens
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatCurrency(query.cost_usd)}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    {query.success ? (
                      <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Success
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Failed
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No query history available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

