import { ArrowUp, ArrowDown, Tag } from 'lucide-react';
import { cn } from '@/libs/utils';
import { formatDateTime } from '@/lib/inventory-utils';

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

interface LabelMovementCardProps {
  movement: LabelMovement;
}

const reasonLabels: Record<string, string> = {
  purchase: 'Purchase Received',
  wastage: 'Wastage / Misprint',
  damage: 'Damage',
  correction: 'Stock Correction',
};

export function LabelMovementCard({ movement }: LabelMovementCardProps) {
  const isAdd = movement.action === 'add';

  return (
    <div className="mobile-card animate-fade-in">
      <div className="flex items-start gap-3">
        {/* Action icon */}
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full shrink-0',
            isAdd ? 'bg-success/10' : 'bg-destructive/10'
          )}
        >
          {isAdd ? (
            <ArrowUp className="h-5 w-5 text-success" />
          ) : (
            <ArrowDown className="h-5 w-5 text-destructive" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Label name + quantity */}
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <h3 className="font-semibold text-foreground truncate">
                {movement.labelName}
              </h3>
            </div>
            <span
              className={cn(
                'text-sm font-bold ml-2 shrink-0',
                isAdd ? 'text-success' : 'text-destructive'
              )}
            >
              {isAdd ? '+' : '-'}
              {movement.quantity.toLocaleString('en-IN')} pcs
            </span>
          </div>

          {/* Reason badge */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="status-badge status-active">
              {reasonLabels[movement.reason] || movement.reason}
            </span>
          </div>

          {/* Remarks */}
          {movement.remarks && (
            <p className="text-xs text-muted-foreground mt-2 truncate">
              Note: {movement.remarks}
            </p>
          )}

          {/* Footer: performed by + date */}
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{movement.performedBy ?? '—'}</span>
            <span>{formatDateTime(movement.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}