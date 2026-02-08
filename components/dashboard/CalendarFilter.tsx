import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/libs/utils';

interface CalendarFilterProps {
  value: Date;
  onChange: (value: Date) => void;
  className?: string;
}

export function CalendarFilter({ value, onChange, className }: CalendarFilterProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'justify-start text-left font-normal',
              'w-[140px] md:w-[200px]'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(value, 'MMM yyyy')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            mode="single"
            selected={value}
            onSelect={(date) => {
              if (date) {
                // Set to the first day of the selected month to avoid timezone issues
                const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
                onChange(firstDayOfMonth);
              }
            }}
            initialFocus
            defaultMonth={value}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
