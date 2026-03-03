import { ArrowUp, ArrowDown, Tag } from 'lucide-react';
import { cn } from '@/libs/utils';
import { formatDateTime } from '@/lib/inventory-utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface LabelMovement {
  id: string;
  labelId: string;
  labelName: string;
  action: 'add' | 'reduce';
  quantity: number;
  reason: string;
  remarks?: string;
  adjustmentDate: string;
  createdAt: string;
  performedBy?: string;
}

interface LabelMovementTableProps {
  movements: LabelMovement[];
}

const reasonLabels: Record<string, string> = {
  purchase: 'Purchase Received',
  wastage: 'Wastage / Misprint',
  damage: 'Damage',
  correction: 'Stock Correction',
};

export function LabelMovementTable({ movements }: LabelMovementTableProps) {
  return (
    <div className="industrial-card overflow-hidden animate-fade-in">
      <Table className="data-table">
        <TableHeader>
          <TableRow>
            <TableHead>Date & Time</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead>Performed By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => {
            const isAdd = movement.action === 'add';

            return (
              <TableRow key={movement.id}>
                {/* Date */}
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatDateTime(movement.createdAt)}
                </TableCell>

                {/* Label name with icon */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 h-6 w-6 rounded-md bg-muted flex items-center justify-center">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <span className="font-medium text-foreground">
                      {movement.labelName}
                    </span>
                  </div>
                </TableCell>

                {/* Action */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full',
                        isAdd ? 'bg-success/10' : 'bg-destructive/10'
                      )}
                    >
                      {isAdd ? (
                        <ArrowUp className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isAdd ? 'text-success' : 'text-destructive'
                      )}
                    >
                      {isAdd ? 'Add' : 'Reduce'}
                    </span>
                  </div>
                </TableCell>

                {/* Quantity */}
                <TableCell>
                  <span
                    className={cn(
                      'font-semibold',
                      isAdd ? 'text-success' : 'text-destructive'
                    )}
                  >
                    {isAdd ? '+' : '-'}
                    {movement.quantity.toLocaleString('en-IN')}{' '}
                    <span className="font-normal text-muted-foreground text-xs">
                      pcs
                    </span>
                  </span>
                </TableCell>

                {/* Reason badge */}
                <TableCell>
                  <span className="status-badge status-active">
                    {reasonLabels[movement.reason] || movement.reason}
                  </span>
                </TableCell>

                {/* Remarks — replaces "Reference" from raw material table */}
                <TableCell className="text-muted-foreground max-w-[180px] truncate">
                  {movement.remarks || '—'}
                </TableCell>

                {/* Performed by */}
                <TableCell className="text-muted-foreground">
                  {movement.performedBy ?? '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}