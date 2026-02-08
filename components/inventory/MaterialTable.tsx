'use client';

import Link from 'next/link';
import { Edit, ArrowUpDown } from 'lucide-react';
import { RawMaterial, getStockStatus, formatCurrency, formatQuantity } from '@/data/sampleData';
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

interface MaterialTableProps {
  materials: RawMaterial[];
}

export function MaterialTable({ materials }: MaterialTableProps) {
  return (
    <div className="industrial-card overflow-hidden animate-fade-in">
      <Table className="data-table">
        <TableHeader>
          <TableRow>
            <TableHead>Raw Material</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Cost/Unit</TableHead>
            <TableHead>Available Stock</TableHead>
            <TableHead>Min. Level</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.map((material) => {
            const stockStatus = getStockStatus(material);

            const statusBadge = {
              normal:
                material.status === 'active'
                  ? { label: 'Active', className: 'status-badge status-active' }
                  : { label: 'Inactive', className: 'status-badge status-inactive' },
              low: { label: 'Low Stock', className: 'status-badge status-low' },
              out: { label: 'Out of Stock', className: 'status-badge status-out' },
            };

            const badge = stockStatus === 'normal' ? statusBadge.normal : statusBadge[stockStatus];

            return (
              <TableRow key={material.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{material.name}</p>
                    {material.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {material.description}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{material.unit.toUpperCase()}</TableCell>
                <TableCell className="font-medium">{formatCurrency(material.costPerUnit)}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'font-semibold',
                      stockStatus === 'out' && 'text-destructive',
                      stockStatus === 'low' && 'text-warning',
                      stockStatus === 'normal' && 'text-foreground'
                    )}
                  >
                    {formatQuantity(material.availableStock, material.unit)}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatQuantity(material.minimumStock, material.unit)}
                </TableCell>
                <TableCell>
                  <span className={badge.className}>{badge.label}</span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Link href={`/edit-material/${material.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit Material</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Link href={`/stock-adjustment/${material.id}`}>
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
