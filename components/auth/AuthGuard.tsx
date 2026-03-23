'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

interface AuthGuardProps {
  children: React.ReactNode;
}

const ROLE_HOME: Record<string, string> = {
  admin:      '/dashboard',
  production: '/production',
  packaging:  '/packaging',
  sales:      '/sales',
  research:   '/research',
  inventory:  '/inventory',
  labels:     '/labels/inventory',
};

export function AuthGuard({ children }: AuthGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'loading') return;

    // If not authenticated, redirect to login
    if (!session) {
      router.push('/');
      return;
    }

    const roles: string[] = (session.user as any)?.roles || [];
    const isAdmin = roles.includes('admin');

    // Non-admin users landing on / or /dashboard get redirected to their role's home
    if (!isAdmin && (pathname === '/' || pathname === '/dashboard')) {
      const homeRoute = roles.map((r) => ROLE_HOME[r]).find(Boolean) || '/dashboard';
      router.replace(homeRoute);
    }
  }, [session, status, router, pathname]);

  // Show loading spinner while checking authentication
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

  // Authenticated, render children
  return <>{children}</>;
}