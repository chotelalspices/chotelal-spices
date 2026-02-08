'use client';

import { AlertTriangle, AlertCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/libs/utils';
import { LowStockItem } from '@/data/dashboardData';
import { formatQuantity } from '@/data/sampleData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface LowStockAlertsProps {
  items: LowStockItem[];
  className?: string;
}

export function LowStockAlerts({ items, className }: LowStockAlertsProps) {
  const router = useRouter();

  if (items.length === 0) {
    return (
      <div className={cn('industrial-card p-4 md:p-6', className)}>
        <h3 className="section-title flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Low Stock Alerts
        </h3>
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <p className="text-sm">All materials are sufficiently stocked</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('industrial-card p-4 md:p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title mb-0 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Low Stock Alerts
        </h3>
        <Button variant="ghost" size="sm" onClick={() => router.push('/inventory')}>
          View All <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      <div className="space-y-2">
        {items.slice(0, 5).map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors',
              item.status === 'critical'
                ? 'bg-destructive/5 hover:bg-destructive/10 border border-destructive/20'
                : 'bg-warning/5 hover:bg-warning/10 border border-warning/20'
            )}
            onClick={() => router.push('/inventory')}
          >
            <div className="flex items-center gap-3 min-w-0">
              {item.status === 'critical' ? (
                <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  Min: {formatQuantity(item.minimumStock, item.unit)}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0 ml-2">
              <Badge
                variant={item.status === 'critical' ? 'destructive' : 'outline'}
                className={item.status === 'low' ? 'border-warning text-warning' : ''}
              >
                {item.status === 'critical' ? 'Out of Stock' : 'Low'}
              </Badge>
              <p className="text-sm font-medium mt-1">
                {formatQuantity(item.availableStock, item.unit)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {items.length > 5 && (
        <p className="text-sm text-muted-foreground text-center mt-4">
          +{items.length - 5} more items need attention
        </p>
      )}
    </div>
  );
}
