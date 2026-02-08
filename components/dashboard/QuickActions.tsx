'use client';

import { 
  Plus, 
  ArrowUpDown, 
  Factory, 
  PackagePlus,
  ShoppingCart, 
  Upload,
  BarChart3,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/libs/utils';
import { useRouter } from 'next/navigation';

interface QuickAction {
  label: string;
  icon: React.ElementType;
  href: string;
  variant?: 'default' | 'secondary' | 'outline';
}

const actions: QuickAction[] = [
  { label: 'Add Raw Material', icon: Plus, href: '/add-material', variant: 'default' },
  { label: 'Movement History', icon: History, href: '/movement-history', variant: 'outline' },
  { label: 'Create Production', icon: Factory, href: '/production/new', variant: 'default' },
  { label: 'Start Packaging', icon: PackagePlus, href: '/packaging', variant: 'outline' },
  { label: 'Record Sale', icon: ShoppingCart, href: '/sales/new', variant: 'default' },
  { label: 'Upload Sales', icon: Upload, href: '/sales/upload', variant: 'outline' },
];

interface QuickActionsProps {
  className?: string;
}

export function QuickActions({ className }: QuickActionsProps) {
  const router = useRouter();

  return (
    <div className={cn('industrial-card p-4 md:p-6', className)}>
      <h3 className="section-title flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        Quick Actions
      </h3>
      
      {/* Desktop: Button grid */}
      <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-6 gap-3">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant}
            className="h-auto py-4 flex flex-col gap-2"
            onClick={() => router.push(action.href)}
          >
            <action.icon className="h-5 w-5" />
            <span className="text-xs text-center leading-tight">{action.label}</span>
          </Button>
        ))}
      </div>

      {/* Mobile: Icon grid */}
      <div className="grid grid-cols-4 gap-3 md:hidden">
        {actions.map((action) => (
          <button
            key={action.label}
            className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            onClick={() => router.push(action.href)}
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <action.icon className="h-5 w-5 text-primary" />
            </div>
            <span className="text-[10px] text-center text-muted-foreground leading-tight">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
