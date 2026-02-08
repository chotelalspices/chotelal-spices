'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { hasPermission } from '@/lib/role-permissions';

interface RouteGuardProps {
  children: React.ReactNode;
  requiredModule: 'inventory' | 'formulations' | 'production' | 'packaging' | 'sales' | 'research' | 'settings';
}

export function RouteGuard({ children, requiredModule }: RouteGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Still loading session

    // If not authenticated, redirect to login
    if (!session) {
      router.push('/');
      return;
    }

    // Check if user has permission for the required module
    const userRoles = (session?.user as any)?.roles || [];
    if (!hasPermission(userRoles as any[], requiredModule)) {
      // Redirect to dashboard if user doesn't have permission
      router.push('/dashboard');
      return;
    }
  }, [session, status, router, requiredModule]);

  // Show loading spinner while checking authentication and permissions
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render anything (redirect will happen)
  if (!session) {
    return null;
  }

  // Check permissions
  const userRoles = (session?.user as any)?.roles || [];
  if (!hasPermission(userRoles as any[], requiredModule)) {
    return null; // Will redirect
  }

  // Authenticated and has permission, render children
  return <>{children}</>;
}
