import { Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/data/dashboardData';
import { cn } from '@/libs/utils';

interface RoleToggleProps {
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  className?: string;
}

export function RoleToggle({ role, onRoleChange, className }: RoleToggleProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-sm text-muted-foreground hidden md:inline">View as:</span>
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        <Button
          variant={role === 'admin' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onRoleChange('admin')}
          className={cn(
            'h-8 gap-1.5',
            role !== 'admin' && 'hover:bg-background/50'
          )}
        >
          <Shield className="h-4 w-4" />
          <span className="hidden sm:inline">Admin</span>
        </Button>
        <Button
          variant={role === 'staff' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onRoleChange('staff')}
          className={cn(
            'h-8 gap-1.5',
            role !== 'staff' && 'hover:bg-background/50'
          )}
        >
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">Staff</span>
        </Button>
      </div>
      <Badge 
        variant={role === 'admin' ? 'default' : 'secondary'}
        className="hidden lg:flex"
      >
        {role === 'admin' ? 'Full Access' : 'Limited View'}
      </Badge>
    </div>
  );
}
