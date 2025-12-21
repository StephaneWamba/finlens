'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { Search, User, ChevronDown, CreditCard, BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { userService } from '@/lib/api/user';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { identifyUser } from '@/lib/utils/logrocket';
import { queryKeys } from '@/lib/api/queryKeys';

export const TopBar = memo(function TopBar() {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // User profile changes infrequently, use longer cache
  // Disable retries for connection errors (444) - fail fast
  // Don't refetch on mount - use cached data for instant navigation
  const { data: user } = useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: userService.getProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes for user profile
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnMount: false, // Use cached data on navigation - instant page loads
    retry: (failureCount, error) => {
      // Don't retry on 444 (connection closed) or connection errors
      const statusCode = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;
      if (statusCode === 444) {
        return false;
      }
      // Retry up to 1 time for other errors
      return failureCount < 1;
    },
  });

  // Identify user in LogRocket when user data is available
  useEffect(() => {
    if (user) {
      identifyUser({
        id: user.id,
        email: user.email,
        name: user.full_name,
        subscription_tier: user.subscription_tier,
        subscription_status: user.subscription_status,
      });
    }
  }, [user]);

  // Keyboard shortcut: Cmd/Ctrl + K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const queriesRemaining = user
    ? user.monthly_query_limit - user.queries_used_this_month
    : 0;

  const userInitials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

  const usagePercentage = user
    ? (user.queries_used_this_month / user.monthly_query_limit) * 100
    : 0;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200/80 bg-white/80 backdrop-blur-md shadow-sm px-4 lg:px-6">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <Input
            ref={searchInputRef}
            type="search"
            placeholder="Search conversations... (⌘K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-gray-50/80 border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
            aria-label="Search conversations"
            aria-describedby="search-help"
          />
          <span id="search-help" className="sr-only">Press Command+K or Control+K to focus search</span>
        </div>
      </div>

      {/* Usage indicator */}
      {user && (
        <div 
          className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-50 to-blue-50/50 border border-blue-100/50 shadow-sm"
          role="status"
          aria-live="polite"
          aria-label={`Query usage: ${user.queries_used_this_month} of ${user.monthly_query_limit} queries used (${Math.round(usagePercentage)}%)`}
        >
          <div className="flex flex-col min-w-[100px]">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-blue-700" aria-hidden="true">
                {user.queries_used_this_month}/{user.monthly_query_limit}
              </span>
              <span className="text-xs text-blue-600 font-semibold" aria-hidden="true">
                {Math.round(usagePercentage)}%
              </span>
            </div>
            <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={user.queries_used_this_month} aria-valuemin={0} aria-valuemax={user.monthly_query_limit} aria-label="Query usage progress">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  usagePercentage >= 90
                    ? 'bg-gradient-to-r from-red-500 to-red-600'
                    : usagePercentage >= 70
                    ? 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600'
                )}
                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
          {queriesRemaining <= 3 && queriesRemaining > 0 && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 shadow-sm" role="status" aria-label="Low query limit warning">
              Low
            </Badge>
          )}
          {queriesRemaining === 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 shadow-sm" role="alert" aria-label="Query limit reached">
              Limit reached
            </Badge>
          )}
        </div>
      )}

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button 
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-gray-50/80 transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label={`User menu for ${user?.full_name || user?.email || 'user'}`}
            aria-haspopup="true"
            aria-expanded="false"
          >
            <Avatar className="h-9 w-9 ring-2 ring-gray-200 group-hover:ring-blue-200 transition-all">
              <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white font-semibold shadow-sm" aria-hidden="true">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user?.full_name || 'User'}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">
              <User className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/billing">
              <CreditCard className="mr-2 h-4 w-4" />
              Billing
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
});

