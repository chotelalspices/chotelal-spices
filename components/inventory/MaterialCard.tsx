'use client';

import Link from 'next/link';
import { MoreVertical, Edit, ArrowUpDown } from 'lucide-react';
import { RawMaterial, getStockStatus, formatCurrency, formatQuantity } from '@/data/sampleData';
import { cn } from '@/libs/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MaterialCardProps {
  material: RawMaterial;
}

export function MaterialCard({ material }: MaterialCardProps) {
  const stockStatus = getStockStatus(material);

  const statusBadge = {
    normal: { label: 'In Stock', className: 'status-badge status-active' },
    low: { label: 'Low Stock', className: 'status-badge status-low' },
    out: { label: 'Out of Stock', className: 'status-badge status-out' },
  };

  const badge =
    stockStatus === 'normal'
      ? material.status === 'active'
        ? statusBadge.normal
        : { label: 'Inactive', className: 'status-badge status-inactive' }
      : statusBadge[stockStatus];

  return (
    <div className="mobile-card animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{material.name}</h3>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(material.costPerUnit)} / {material.unit}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={badge.className}>{badge.label}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem asChild>
                <Link
                  href={`/edit-material/${material.id}`}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit Material
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link
                  href={`/stock-adjustment/${material.id}`}
                  className="flex items-center gap-2"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  Adjust Stock
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-end justify-between">
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
            {formatQuantity(material.availableStock, material.unit)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground mb-1">Min. Level</p>
          <p className="text-sm text-muted-foreground">
            {formatQuantity(material.minimumStock, material.unit)}
          </p>
        </div>
      </div>
    </div>
  );
}
