import { ArrowUp, ArrowDown } from 'lucide-react';
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
            <TableHead>Reference</TableHead>
            <TableHead>Performed By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => {
            const isAdd = movement.action === 'add';
            
            return (
              <TableRow key={movement.id}>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatDateTime(movement.createdAt)}
                </TableCell>
                <TableCell className="font-medium">{movement.rawMaterialName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full',
                      isAdd ? 'bg-success/10' : 'bg-destructive/10'
                    )}>
                      {isAdd ? (
                        <ArrowUp className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </div>
                    <span className={cn(
                      'text-sm font-medium',
                      isAdd ? 'text-success' : 'text-destructive'
                    )}>
                      {isAdd ? 'Add' : 'Reduce'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={cn(
                    'font-semibold',
                    isAdd ? 'text-success' : 'text-destructive'
                  )}>
                    {isAdd ? '+' : '-'}{movement.quantity}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="status-badge status-active">
                    {reasonLabels[movement.reason] || movement.reason}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-[150px] truncate">
                  {movement.reference || '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">{movement.performedBy}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
