'use client';

import { useEffect, memo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  LogOut,
  Menu,
  X,
  Plus,
  Clock,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { authService } from '@/lib/api/auth';
import { useQuery } from '@tanstack/react-query';
import { chatService } from '@/lib/api/chat';
import { formatDistanceToNow } from 'date-fns';
import { useSidebar } from '@/lib/contexts/SidebarContext';
import { clearUser } from '@/lib/utils/logrocket';
import { queryKeys } from '@/lib/api/queryKeys';

interface Session {
  session_id: string;
  last_message?: string;
  last_updated?: string;
  message_count?: number;
}

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobileOpen, setIsMobileOpen } = useSidebar();

  // Fetch sessions from backend - chat sessions need real-time updates
  // Only refetch if data is stale (older than 15 seconds) - prevents unnecessary refetches on navigation
  const { data: sessionsData, refetch: refetchSessions, isLoading: isLoadingSessions, isError: isErrorSessions } = useQuery({
    queryKey: queryKeys.chat.sessions(50),
    queryFn: () => chatService.listSessions(50),
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Use cached data if fresh - only refetch if stale
    gcTime: 2 * 60 * 1000, // Keep in cache for 2 minutes
    retry: (failureCount, error) => {
      // Don't retry on 444 (connection closed) - fail fast
      const statusCode = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;
      if (statusCode === 444) {
        return false;
      }
      // Retry up to 1 time for other errors
      return failureCount < 1;
    },
    staleTime: 15 * 1000, // 15 seconds for chat sessions (more frequent updates)
  });

  const sessions: Session[] = sessionsData?.sessions || [];

  const handleSignOut = async () => {
    try {
      await authService.signout();
      // Clear user identification in LogRocket
      clearUser();
      router.push('/auth/signin');
    } catch {
      // Even if signout fails, clear local storage and redirect
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
      // Clear user identification in LogRocket
      clearUser();
      router.push('/auth/signin');
    }
  };

  const handleNewChat = () => {
    router.push('/dashboard');
    setIsMobileOpen(false);
  };

  // Check if we're on the main chat page
  const isChatPage = pathname === '/dashboard';

  const handleSessionClick = (sessionId: string) => {
    // Use router.push with shallow routing to update URL without full page reload
    router.push(`/dashboard?session=${encodeURIComponent(sessionId)}`, { scroll: false });
    setIsMobileOpen(false);
  };

  // Refetch sessions when navigating back to dashboard or when session is updated
  useEffect(() => {
    const handleSessionUpdate = () => {
      refetchSessions();
    };

    globalThis.addEventListener('session-updated', handleSessionUpdate);

    return () => {
      globalThis.removeEventListener('session-updated', handleSessionUpdate);
    };
  }, [refetchSessions]);

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          aria-label={isMobileOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={isMobileOpen}
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen w-64 border-r border-gray-200 bg-white shadow-lg transition-transform lg:translate-x-0 lg:z-40',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{ 
          backgroundColor: '#ffffff', 
          opacity: 1,
          isolation: 'isolate',
          willChange: 'transform'
        }}
        aria-label="Navigation sidebar"
      >
        <div className="flex h-full flex-col" style={{ backgroundColor: '#ffffff', opacity: 1 }}>
          {/* Logo with Close Button */}
          <div className="flex h-16 items-center justify-between border-b border-gray-200 px-6" style={{ backgroundColor: '#ffffff', opacity: 1 }}>
            <Link 
              href="/dashboard" 
              className="flex items-center space-x-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-md" 
              onClick={() => setIsMobileOpen(false)}
              aria-label="FinLens home"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-xl group-hover:shadow-blue-500/30 transition-all duration-200" aria-hidden="true">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                FinLens
              </span>
            </Link>
            {/* Close button - only visible on mobile */}
             <Button
               variant="ghost"
               size="icon"
               onClick={() => setIsMobileOpen(false)}
               className="lg:hidden h-8 w-8 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
               aria-label="Close sidebar"
             >
               <X className="h-5 w-5" />
             </Button>
          </div>

          {/* Navigation Links */}
          <div className="px-3 pt-4 pb-2 space-y-2">
            <Button
              onClick={handleNewChat}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              size="sm"
              aria-label="Start a new chat conversation"
            >
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
              New Chat
            </Button>
            <Link
              href="/dashboard/documents"
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                pathname === '/dashboard/documents'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              aria-label="View documents"
            >
              <FileText className="h-4 w-4" />
              Documents
            </Link>
          </div>

          {/* Sessions List */}
          <nav className="flex-1 overflow-y-auto px-3 py-2" style={{ backgroundColor: '#ffffff', opacity: 1 }} aria-label="Chat history">
            <h2 className="sr-only">Recent Chats</h2>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2" aria-hidden="true">
              Recent Chats
            </div>
            {isLoadingSessions ? (
              <div className="space-y-1 px-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-start space-x-2 rounded-lg px-2.5 py-2">
                    <Skeleton className="h-4 w-4 mt-0.5 flex-shrink-0 rounded" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Skeleton className="h-3.5 w-full rounded" />
                      <Skeleton className="h-3 w-20 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isErrorSessions ? (
              <div className="text-center py-6 px-4" role="alert" aria-live="polite">
                <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" aria-hidden="true" />
                <p className="text-xs text-gray-500 mb-1">Unable to load chat history</p>
                <p className="text-xs text-gray-400 mb-3">The backend server may not be running</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchSessions()}
                  className="text-xs"
                  aria-label="Retry loading chat history"
                >
                  Retry
                </Button>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 px-4" role="status" aria-live="polite">
                <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" aria-hidden="true" />
                <p className="text-xs text-gray-500">No chat history yet</p>
                <p className="text-xs text-gray-400 mt-1">Start a new conversation</p>
              </div>
            ) : (
              <ul className="space-y-1" role="list">
                {sessions.map((session) => {
                  const isActive = isChatPage && 
                    typeof globalThis !== 'undefined' &&
                    globalThis.location &&
                    new URLSearchParams(globalThis.location.search).get('session') === session.session_id;
                  
                  const sessionTitle = session.last_message || 'New conversation';
                  const sessionTime = session.last_updated 
                    ? formatDistanceToNow(new Date(session.last_updated), { addSuffix: true })
                    : '';
                  
                  return (
                    <li key={session.session_id} role="listitem">
                      <button
                        onClick={() => handleSessionClick(session.session_id)}
                        className={cn(
                          'w-full text-left group relative flex items-start space-x-2 rounded-lg px-2.5 py-2 text-sm transition-all duration-200',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                          isActive
                            ? 'bg-gradient-to-r from-blue-50 to-blue-50/50 text-blue-700 shadow-sm'
                            : 'text-gray-600 hover:bg-gray-50/80 hover:text-gray-900'
                        )}
                        aria-label={`${sessionTitle}${sessionTime ? `, ${sessionTime}` : ''}${isActive ? ', currently active' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-blue-600 to-blue-500 rounded-r-full" aria-hidden="true" />
                      )}
                      <MessageSquare className={cn(
                        'h-4 w-4 mt-0.5 flex-shrink-0 transition-transform duration-200',
                        isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                      )} aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-xs">
                          {sessionTitle}
                        </div>
                        {session.last_updated && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            <time dateTime={session.last_updated}>
                              {sessionTime}
                            </time>
                          </div>
                        )}
                      </div>
                    </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>

          {/* Bottom section */}
          <div className="border-t border-gray-200 p-4" style={{ backgroundColor: '#f9fafb' }}>
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50/50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              onClick={handleSignOut}
              aria-label="Sign out of your account"
            >
              <LogOut className="mr-3 h-4 w-4" aria-hidden="true" />
              <span className="font-medium">Sign out</span>
            </Button>
          </div>
        </div>

      </aside>
    </>
  );
});
