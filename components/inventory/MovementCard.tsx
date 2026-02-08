import { ArrowUp, ArrowDown } from 'lucide-react';
import { StockMovement } from '@/types/inventory';
import { formatQuantity, formatDateTime } from '@/lib/inventory-utils';
import { cn } from '@/libs/utils';

interface MovementCardProps {
  movement: StockMovement;
}

const reasonLabels: Record<string, string> = {
  purchase: 'Purchase',
  wastage: 'Wastage',
  damage: 'Damage',
  correction: 'Correction',
  production: 'Production',
};

export function MovementCard({ movement }: MovementCardProps) {
  const isAdd = movement.action === 'add';

  return (
    <div className="mobile-card animate-fade-in">
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full shrink-0',
          isAdd ? 'bg-success/10' : 'bg-destructive/10'
        )}>
          {isAdd ? (
            <ArrowUp className="h-5 w-5 text-success" />
          ) : (
            <ArrowDown className="h-5 w-5 text-destructive" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-semibold text-foreground truncate">{movement.rawMaterialName}</h3>
            <span className={cn(
              'text-sm font-bold ml-2',
              isAdd ? 'text-success' : 'text-destructive'
            )}>
              {isAdd ? '+' : '-'}{movement.quantity}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="status-badge status-active">
              {reasonLabels[movement.reason] || movement.reason}
            </span>
          </div>
          
          {movement.reference && (
            <p className="text-xs text-muted-foreground mt-2 truncate">
              Ref: {movement.reference}
            </p>
          )}
          
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{movement.performedBy}</span>
            <span>{formatDateTime(movement.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
