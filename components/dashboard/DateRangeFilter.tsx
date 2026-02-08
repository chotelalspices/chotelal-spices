import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateRangeOption, getDateRangeLabel } from '@/data/dashboardData';
import { cn } from '@/libs/utils';

interface DateRangeFilterProps {
  value: DateRangeOption;
  onChange: (value: DateRangeOption) => void;
  className?: string;
}

const options: DateRangeOption[] = ['today', 'week', 'month'];

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Desktop: Button group */}
      <div className="hidden md:flex items-center gap-1 bg-muted rounded-lg p-1">
        {options.map((option) => (
          <Button
            key={option}
            variant={value === option ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onChange(option)}
            className={cn(
              'h-8',
              value !== option && 'hover:bg-background/50'
            )}
          >
            {getDateRangeLabel(option)}
          </Button>
        ))}
      </div>

      {/* Mobile: Dropdown */}
      <div className="md:hidden">
        <Select value={value} onValueChange={(v) => onChange(v as DateRangeOption)}>
          <SelectTrigger className="w-[140px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {getDateRangeLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
