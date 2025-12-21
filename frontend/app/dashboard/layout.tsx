'use client';

import { Sidebar } from '@/components/dashboard/Sidebar';
import { TopBar } from '@/components/dashboard/TopBar';
import { SidebarProvider, useSidebar } from '@/lib/contexts/SidebarContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SkipToMainContent } from '@/components/ui/SkipToMainContent';
import { cn } from '@/lib/utils';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isMobileOpen, setIsMobileOpen } = useSidebar();

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50/50">
      <Sidebar />
      {/* Mobile overlay - outside sidebar, behind sidebar */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-[45]"
          onClick={() => setIsMobileOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsMobileOpen(false);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close sidebar overlay"
          style={{ isolation: 'isolate' }}
        />
      )}
      <div 
        className={cn(
          'flex flex-1 flex-col overflow-hidden lg:pl-64 transition-all duration-300 relative z-30',
          isMobileOpen && 'lg:blur-0 blur-md brightness-[0.6]'
        )}
      >
        <SkipToMainContent />
        <TopBar />
        <main id="main-content" className="flex-1 overflow-y-auto bg-gradient-to-b from-transparent to-gray-50/30" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <ProtectedRoute>
        <SidebarProvider>
          <DashboardContent>{children}</DashboardContent>
        </SidebarProvider>
      </ProtectedRoute>
    </ErrorBoundary>
  );
}

