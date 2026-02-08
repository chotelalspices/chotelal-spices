import { LucideIcon } from 'lucide-react';
import { cn } from '@/libs/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'warning' | 'danger' | 'success';
}

const variantStyles = {
  default: 'bg-primary/10 text-primary',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  success: 'bg-success/10 text-success',
};

export function StatCard({ title, value, subtitle, icon: Icon, variant = 'default' }: StatCardProps) {
  return (
    <div className="stat-card animate-fade-in bg-white border border-gray-200 p-4 rounded-md shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl md:text-3xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg shrink-0', variantStyles[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
