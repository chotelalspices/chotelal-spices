'use client';

import Link from 'next/link';
import { MoreVertical, Edit, ArrowUpDown, Tag } from 'lucide-react';
import { cn } from '@/libs/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Label {
  id: string;
  name: string;
  status: string;
  availableStock: number;
  minimumStock: number;
  unit?: string;
}

const getLabelStockStatus = (label: Label) => {
  if (label.availableStock === 0) return 'out';
  if (label.availableStock <= label.minimumStock) return 'low';
  return 'normal';
};

const formatLabelQty = (qty: number) =>
  qty.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

interface LabelCardProps {
  label: Label;
}

export function LabelCard({ label }: LabelCardProps) {
  const stockStatus = getLabelStockStatus(label);

  const statusBadge = {
    normal: { label: 'In Stock', className: 'status-badge status-active' },
    low: { label: 'Low Stock', className: 'status-badge status-low' },
    out: { label: 'Out of Stock', className: 'status-badge status-out' },
  };

  const badge =
    stockStatus === 'normal'
      ? label.status === 'active'
        ? statusBadge.normal
        : { label: 'Inactive', className: 'status-badge status-inactive' }
      : statusBadge[stockStatus];

  const stockPct = label.minimumStock > 0
    ? Math.min((label.availableStock / (label.minimumStock * 2)) * 100, 100)
    : 100;

  const progressColor =
    stockStatus === 'out'
      ? 'bg-destructive'
      : stockStatus === 'low'
      ? 'bg-warning'
      : 'bg-emerald-500';

  return (
    <div className="mobile-card animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-shrink-0 h-8 w-8 rounded-md bg-muted flex items-center justify-center">
            <Tag className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{label.name}</h3>
            <p className="text-xs text-muted-foreground">Label · pcs</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className={badge.className}>{badge.label}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem asChild>
                <Link href={`/labels/edit-label/${label.id}`} className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Edit Label
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/labels/stock-adjustment/${label.id}`} className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  Adjust Stock
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stock numbers */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Available Stock</p>
          <p
            className={cn(
              'text-lg font-bold',
              stockStatus === 'out' && 'text-destructive',
              stockStatus === 'low' && 'text-warning',
              stockStatus === 'normal' && 'text-foreground'
            )}
          >
            {formatLabelQty(label.availableStock)} <span className="text-sm font-normal text-muted-foreground">pcs</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground mb-1">Min. Level</p>
          <p className="text-sm text-muted-foreground">{formatLabelQty(label.minimumStock)} pcs</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', progressColor)}
          style={{ width: `${stockPct}%` }}
        />
      </div>
    </div>
  );
}