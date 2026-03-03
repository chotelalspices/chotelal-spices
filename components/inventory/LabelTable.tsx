'use client';

import Link from 'next/link';
import { Edit, ArrowUpDown, Tag } from 'lucide-react';
import { cn } from '@/libs/utils';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

interface LabelTableProps {
  labels: Label[];
}

export function LabelTable({ labels }: LabelTableProps) {
  return (
    <div className="industrial-card overflow-hidden animate-fade-in">
      <Table className="data-table">
        <TableHeader>
          <TableRow>
            <TableHead>Label Name</TableHead>
            <TableHead>Available Stock</TableHead>
            <TableHead>Min. Level</TableHead>
            <TableHead>Stock Health</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {labels.map((label) => {
            const stockStatus = getLabelStockStatus(label);

            const statusBadge = {
              normal:
                label.status === 'active'
                  ? { label: 'Active', className: 'status-badge status-active' }
                  : { label: 'Inactive', className: 'status-badge status-inactive' },
              low: { label: 'Low Stock', className: 'status-badge status-low' },
              out: { label: 'Out of Stock', className: 'status-badge status-out' },
            };

            const badge =
              stockStatus === 'normal' ? statusBadge.normal : statusBadge[stockStatus];

            const stockPct =
              label.minimumStock > 0
                ? Math.min((label.availableStock / (label.minimumStock * 2)) * 100, 100)
                : 100;

            const progressColor =
              stockStatus === 'out'
                ? 'bg-destructive'
                : stockStatus === 'low'
                ? 'bg-warning'
                : 'bg-emerald-500';

            return (
              <TableRow key={label.id}>
                {/* Label Name */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 h-7 w-7 rounded-md bg-muted flex items-center justify-center">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground">{label.name}</p>
                  </div>
                </TableCell>

                {/* Available Stock */}
                <TableCell>
                  <span
                    className={cn(
                      'font-semibold',
                      stockStatus === 'out' && 'text-destructive',
                      stockStatus === 'low' && 'text-warning',
                      stockStatus === 'normal' && 'text-foreground'
                    )}
                  >
                    {formatLabelQty(label.availableStock)}{' '}
                    <span className="font-normal text-muted-foreground text-xs">pcs</span>
                  </span>
                </TableCell>

                {/* Min Level */}
                <TableCell className="text-muted-foreground">
                  {formatLabelQty(label.minimumStock)}{' '}
                  <span className="text-xs">pcs</span>
                </TableCell>

                {/* Stock Health Progress Bar */}
                <TableCell>
                  <div className="flex items-center gap-2 min-w-[110px]">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', progressColor)}
                        style={{ width: `${stockPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {Math.round(stockPct)}%
                    </span>
                  </div>
                </TableCell>

                {/* Status Badge */}
                <TableCell>
                  <span className={badge.className}>{badge.label}</span>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Link href={`/labels/edit-label/${label.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit Label</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Link href={`/labels/stock-adjustment/${label.id}`}>
                            <ArrowUpDown className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Adjust Stock</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}