import { ArrowUp, ArrowDown, TrendingUp, TrendingDown } from 'lucide-react';
import { StockMovement } from '@/types/inventory';
import { formatDateTime } from '@/lib/inventory-utils';
import { cn } from '@/libs/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MovementTableProps {
  movements: StockMovement[];
}

const reasonLabels: Record<string, string> = {
  purchase: 'Purchase',
  wastage: 'Wastage',
  damage: 'Damage',
  correction: 'Correction',
  production: 'Production',
};

export function MovementTable({ movements }: MovementTableProps) {
  return (
    <div className="industrial-card overflow-hidden animate-fade-in">
      <Table className="data-table">
        <TableHeader>
          <TableRow>
            <TableHead>Date & Time</TableHead>
            <TableHead>Raw Material</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Cost Change</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Performed By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => {
            const isAdd = movement.action === 'add';
            const hasCostChange =
              movement.previousCostPerUnit !== undefined &&
              movement.newCostPerUnit !== undefined &&
              movement.previousCostPerUnit !== movement.newCostPerUnit;
            const costIncreased =
              hasCostChange &&
              movement.newCostPerUnit! > movement.previousCostPerUnit!;

            return (
              <TableRow key={movement.id}>

                {/* Date */}
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatDateTime(movement.createdAt)}
                </TableCell>

                {/* Raw Material */}
                <TableCell className="font-medium">{movement.rawMaterialName}</TableCell>

                {/* Action */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full',
                      isAdd ? 'bg-success/10' : 'bg-destructive/10'
                    )}>
                      {isAdd
                        ? <ArrowUp className="h-3.5 w-3.5 text-success" />
                        : <ArrowDown className="h-3.5 w-3.5 text-destructive" />}
                    </div>
                    <span className={cn(
                      'text-sm font-medium',
                      isAdd ? 'text-success' : 'text-destructive'
                    )}>
                      {isAdd ? 'Add' : 'Reduce'}
                    </span>
                  </div>
                </TableCell>

                {/* Quantity */}
                <TableCell>
                  <span className={cn(
                    'font-semibold',
                    isAdd ? 'text-success' : 'text-destructive'
                  )}>
                    {isAdd ? '+' : '-'}{Number(movement.quantity).toFixed(2)}
                  </span>
                </TableCell>

                {/* Reason */}
                <TableCell>
                  <span className="status-badge status-active">
                    {reasonLabels[movement.reason] || movement.reason}
                  </span>
                </TableCell>

                {/* Cost Change */}
                <TableCell>
                  {hasCostChange ? (
                    <div className="flex items-center gap-1.5 text-sm">
                      {costIncreased
                        ? <TrendingUp className="h-3.5 w-3.5 text-destructive shrink-0" />
                        : <TrendingDown className="h-3.5 w-3.5 text-success shrink-0" />}
                      <span className="text-muted-foreground text-xs">
                        ₹{movement.previousCostPerUnit!.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground text-xs">→</span>
                      <span className="font-semibold text-xs text-success">
                        ₹{movement.newCostPerUnit!.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>

                {/* Reference */}
                <TableCell className="text-muted-foreground max-w-[150px] truncate">
                  {movement.reference || '—'}
                </TableCell>

                {/* Performed By */}
                <TableCell className="text-muted-foreground">
                  {movement.performedBy}
                </TableCell>

              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}