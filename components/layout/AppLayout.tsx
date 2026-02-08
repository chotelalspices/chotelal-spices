'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { 
  Package, 
  History, 
  PlusCircle, 
  Menu,
  X,
  Boxes,
  FileText,
  Factory,
  ShoppingCart,
  PackageCheck,
  LayoutDashboard,
  BarChart3,
  Settings,
  Users,
  LogOut,
  Key
} from 'lucide-react';
import { cn } from '@/libs/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { hasPermission, getAccessibleModules } from '@/lib/role-permissions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: null },
  { name: 'Inventory', href: '/inventory', icon: Package, module: 'inventory' as const },
  { name: 'Formulations', href: '/formulations', icon: FileText, module: 'formulations' as const },
  { name: 'Production', href: '/production', icon: Factory, module: 'production' as const },
  { name: 'Packaging', href: '/packaging', icon: PackageCheck, module: 'packaging' as const },
  { name: 'Sales', href: '/sales', icon: ShoppingCart, module: 'sales' as const },
  { name: 'Research', href: '/research', icon: Boxes, module: 'research' as const },
  { name: 'Users', href: '/users', icon: Users, module: 'settings' as const },
  { name: 'Settings', href: '/settings', icon: Settings, module: 'settings' as const },
];

const mobileNav = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: null },
  { name: 'Inventory', href: '/inventory', icon: Package, module: 'inventory' as const },
  { name: 'Formulations', href: '/formulations', icon: FileText, module: 'formulations' as const },
  { name: 'Production', href: '/production', icon: Factory, module: 'production' as const },
  { name: 'Packaging', href: '/packaging', icon: PackageCheck, module: 'packaging' as const },
  { name: 'Sales', href: '/sales', icon: ShoppingCart, module: 'sales' as const },
  { name: 'Research', href: '/research', icon: Boxes, module: 'research' as const },
];

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: session } = useSession();

  const isActiveRoute = (href: string) => {
    if (href === '/dashboard') return pathname === '/' || pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  // Get user data from session
  const userFullName = (session?.user as any)?.fullName || 'User';
  const userRoles = (session?.user as any)?.roles || [];
  const roleDisplayName = userRoles.includes('admin') ? 'Administrator' : 
    userRoles.includes('production') ? 'Production' :
    userRoles.includes('packaging') ? 'Packaging' :
    userRoles.includes('sales') ? 'Sales' :
    userRoles.includes('research') ? 'Research' : 'User';

  // Check if user has permission to access a route
  const hasRoutePermission = (module: 'inventory' | 'formulations' | 'production' | 'packaging' | 'sales' | 'research' | 'settings' | null) => {
    // Dashboard is visible to all users
    if (module === null) return true;
    
    // Use the existing role-permissions system
    return hasPermission(userRoles as any[], module);
  };
  
  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Handle logout
  const handleLogout = async () => {
    await signOut({ 
      redirect: false,
      callbackUrl: '/'
    });
    router.push('/');
    router.refresh();
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex flex-1 flex-col bg-sidebar-background">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
              <Package className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-sidebar-foreground">SpiceMaster</h1>
              <p className="text-xs text-sidebar-foreground/60">Inventory System</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navigation.filter(item => hasRoutePermission(item.module)).map((item) => {
              const isActive = isActiveRoute(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-sidebar-border p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full rounded-lg hover:bg-sidebar-accent transition-colors p-2 -m-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent">
                    <span className="text-sm font-medium text-sidebar-foreground">
                      {getInitials(userFullName)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-sidebar-foreground truncate">
                      {userFullName}
                    </p>
                    <p className="text-xs text-sidebar-foreground/60 truncate">
                      {roleDisplayName}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{userFullName}</span>
                    <span className="text-xs text-muted-foreground">{roleDisplayName}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push('/reset-password')}
                  className="cursor-pointer"
                >
                  <Key className="mr-2 h-4 w-4" />
                  <span>Reset Password</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Package className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">SpiceMaster</span>
        </div>
        
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0">
            <div className="flex flex-col h-full bg-sidebar-background">
              <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border">
                <span className="font-semibold text-sidebar-foreground">Menu</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <nav className="flex-1 space-y-1 px-3 py-4">
                {navigation.filter(item => hasRoutePermission(item.module)).map((item) => {
                  const isActive = isActiveRoute(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-primary'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  );
                })}
                {/* Reset Password - Mobile */}
                <div className="border-t border-sidebar-border pt-2 mt-2">
                  <Link
                    href="/reset-password"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    <Key className="h-5 w-5" />
                    Reset Password
                  </Link>
                </div>
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-card h-16 px-2">
        {mobileNav.filter(item => hasRoutePermission(item.module)).map((item) => {
          const isActive = isActiveRoute(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors flex-1',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="md:pl-64">
        <div className="min-h-screen pt-14 pb-20 md:pt-0 md:pb-0">
          <div className="p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
    </AuthGuard>
  );
}
