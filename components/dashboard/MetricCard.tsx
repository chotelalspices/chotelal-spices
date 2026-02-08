'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/libs/utils';
import { useRouter } from 'next/navigation';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'warning' | 'danger' | 'success' | 'primary';
  href?: string;
  className?: string;
}

const variantStyles = {
  default: {
    icon: 'bg-muted text-muted-foreground',
    card: '',
  },
  primary: {
    icon: 'bg-primary/10 text-primary',
    card: '',
  },
  warning: {
    icon: 'bg-warning/10 text-warning',
    card: 'border-l-4 border-l-warning',
  },
  danger: {
    icon: 'bg-destructive/10 text-destructive',
    card: 'border-l-4 border-l-destructive',
  },
  success: {
    icon: 'bg-success/10 text-success',
    card: 'border-l-4 border-l-success',
  },
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  href,
  className,
}: MetricCardProps) {
  const router = useRouter();
  const styles = variantStyles[variant];

  const handleClick = () => {
    if (href) {
      router.push(href);
    }
  };

  return (
    <div
      className={cn(
        'stat-card animate-fade-in',
        styles.card,
        href && 'cursor-pointer hover:shadow-md transition-all hover:scale-[1.02] bg-white rounded-md border border-gray-200 p-4',
        className
      )}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl md:text-3xl font-bold text-foreground truncate">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
            styles.icon
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
