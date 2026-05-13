'use client';

import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { RecordPagination, usePaginatedRecords } from '@/components/ui/record-pagination';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import {
  Plus, Upload, Filter, TrendingUp, IndianRupee, Package,
  Pencil, Trash2, Loader2, User, CheckCircle2, ArrowUpRight,
  ArrowDownRight, ChevronDown, ChevronRight, X, Check, ChevronsUpDown,
  Download, Settings2, Save, BarChart3, History, CreditCard, MapPin,
  BriefcaseBusiness, type LucideIcon,
} from 'lucide-react';

import { StatCard } from '@/components/inventory/StatCard';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/libs/utils';
import {
  calculateSalesSummary, formatCurrency, formatSaleDate, type SalesRecord,
} from '@/data/salesData';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
type ClientNameOrder = 'latest' | 'az' | 'za';
type PaymentStatus = 'paid' | 'unpaid' | 'partial';
const CLIENT_NAME_ORDER_LABELS: Record<ClientNameOrder, string> = {
  latest: 'Default',
  az: 'A-Z',
  za: 'Z-A',
};
const PAYMENT_STATUS_OPTIONS = ['Paid', 'Unpaid', 'Partially Paid'];
const PAYMENT_STATUS_VALUES: Record<string, PaymentStatus> = {
  Paid: 'paid',
  Unpaid: 'unpaid',
  'Partially Paid': 'partial',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientMeta {
  id: string;
  clientName: string;
  city: string | null;
  salesman: string | null;
}

interface ClientGroup {
  groupKey: string;
  clientName: string;
  voucherNo: string;
  voucherType: string;
  saleDate: string;
  records: SalesRecord[];
  groupTotal: number;
  groupProfit: number;
  paymentStatus?: PaymentStatus;
  amountPaid?: number;
  amountDue?: number;
  paymentNote?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeRecordPayment(record: SalesRecord): {
  paymentStatus: PaymentStatus;
  amountPaid: number;
  amountDue: number;
} {
  const total = record.totalAmount ?? 0;
  const explicitPaid = typeof record.amountPaid === 'number' ? record.amountPaid : undefined;
  const amountPaid = Math.min(
    Math.max(record.paymentStatus === 'paid' ? (explicitPaid ?? total) : (explicitPaid ?? 0), 0),
    total,
  );
  const amountDue = Math.max(0, total - amountPaid);

  return {
    paymentStatus: total <= 0 || amountDue <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid',
    amountPaid,
    amountDue,
  };
}

function parseSalesCalendarDate(dateString: string): Date {
  const [datePart] = dateString.split('T');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return new Date(dateString);

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function getDateFilterBoundary(dateString: string, endOfDay = false): Date {
  const date = parseSalesCalendarDate(dateString);
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date;
}

function getSalesDateKey(dateString: string): string {
  return dateString.split('T')[0];
}

function getSalesDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatSalesDateFilterLabel(dateString: string): string {
  return parseSalesCalendarDate(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function groupByClient(records: SalesRecord[]): ClientGroup[] {
  const map = new Map<string, ClientGroup>();
  records.forEach((record) => {
    const key = record.voucherNo?.trim() || `${(record.clientName || 'Unknown').trim()}__${record.saleDate}`;
    if (!map.has(key)) {
      map.set(key, {
        groupKey: key,
        clientName: record.clientName?.trim() || 'Unknown Client',
        voucherNo: record.voucherNo?.trim() || '',
        voucherType: record.voucherType?.trim() || '',
        saleDate: record.saleDate,
        records: [],
        groupTotal: 0,
        groupProfit: 0,
        paymentStatus: 'unpaid',
        amountPaid: 0,
        amountDue: 0,
        paymentNote: record.paymentNote,
      });
    }
    const g = map.get(key)!;
    g.records.push(record);
    g.groupTotal += record.totalAmount ?? 0;
    g.groupProfit += record.profit ?? 0;
    const payment = normalizeRecordPayment(record);
    g.amountPaid = (g.amountPaid ?? 0) + payment.amountPaid;
    g.amountDue = (g.amountDue ?? 0) + payment.amountDue;
  });
  return Array.from(map.values()).map((group) => {
    const amountPaid = Number((group.amountPaid ?? 0).toFixed(2));
    const amountDue = Number(Math.max(0, group.groupTotal - amountPaid).toFixed(2));
    return {
      ...group,
      amountPaid,
      amountDue,
      paymentStatus: group.groupTotal <= 0 || amountDue <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid',
    };
  });
}

// ─── Multi-select filter ──────────────────────────────────────────────────────

function MultiSelectFilter({
  label, values, onChange, options, placeholder, className, icon: Icon, iconOnly = false,
}: {
  label: string; values: string[]; onChange: (v: string[]) => void;
  options: string[]; placeholder: string; className?: string; icon?: LucideIcon; iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (opt: string) =>
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);
  const displayLabel =
    values.length === 0 ? placeholder : values.length === 1 ? values[0] : `${values.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox"
          aria-label={label}
          title={label}
          className={cn(
            iconOnly ? 'relative h-9 w-9 justify-center p-0' : 'justify-between font-normal min-w-0',
            className,
            values.length > 0 && 'border-primary text-primary',
          )}>
          {iconOnly && Icon ? (
            <>
              <Icon className="h-4 w-4" />
              {values.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none text-primary-foreground">
                  {values.length}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="truncate max-w-[160px]">{displayLabel}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
            <CommandGroup>
              {values.length > 0 && (
                <CommandItem onSelect={() => onChange([])}>
                  <X className="mr-2 h-4 w-4" />Clear all
                </CommandItem>
              )}
              {options.map((opt) => {
                const selected = values.includes(opt);
                return (
                  <CommandItem key={opt} value={opt} onSelect={() => toggle(opt)}>
                    <div className={cn(
                      'mr-2 flex h-4 w-4 items-center justify-center rounded border',
                      selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground',
                    )}>
                      {selected && <Check className="h-3 w-3" />}
                    </div>
                    {opt}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Creatable combobox ───────────────────────────────────────────────────────

const compactCalendarClassNames = {
  root: 'relative',
  months: 'block',
  month: 'space-y-2',
  month_caption: 'hidden',
  month_grid: 'w-full table-fixed border-collapse',
  weekdays: 'border-0',
  weekday: 'h-7 text-center text-[11px] font-semibold text-muted-foreground',
  week: 'border-0',
  day: 'h-8 p-0 text-center text-xs',
  day_button: 'inline-flex h-8 w-8 items-center justify-center rounded-full p-0 text-xs font-medium text-foreground transition-colors hover:bg-muted',
  selected: '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground',
  today: '[&>button]:border [&>button]:border-primary [&>button]:text-primary',
  outside: '[&>button]:invisible',
  disabled: '[&>button]:pointer-events-none [&>button]:text-muted-foreground [&>button]:opacity-35',
};

function DateFilterButton({
  label,
  value,
  onChange,
  minDate,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? parseSalesCalendarDate(value) : undefined;
  const minCalendarDate = minDate ? parseSalesCalendarDate(minDate) : undefined;
  const initialCalendarMonth = selectedDate ?? minCalendarDate ?? new Date();
  const [displayMonth, setDisplayMonth] = useState(initialCalendarMonth);
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = 2000;
    const endYear = currentYear + 10;
    return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) setDisplayMonth(selectedDate ?? minCalendarDate ?? new Date());
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-9 min-w-0 justify-start px-2 text-left font-normal',
            value && 'border-primary text-primary',
            className,
          )}
        >
          <span className="min-w-0 leading-none">
            <span className="block text-[10px] font-medium uppercase text-muted-foreground">{label}</span>
            <span className="mt-0.5 block truncate text-xs font-semibold">
              {value ? formatSalesDateFilterLabel(value) : 'Select date'}
            </span>
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[288px] border bg-white p-0 text-foreground shadow-xl" align="start">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Select
            value={String(displayMonth.getMonth())}
            onValueChange={(nextMonth) => {
              setDisplayMonth(new Date(displayMonth.getFullYear(), Number(nextMonth), 1));
            }}
          >
            <SelectTrigger className="h-8 flex-1 text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((monthName, index) => (
                <SelectItem key={monthName} value={String(index)}>
                  {monthName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(displayMonth.getFullYear())}
            onValueChange={(nextYear) => {
              setDisplayMonth(new Date(Number(nextYear), displayMonth.getMonth(), 1));
            }}
          >
            <SelectTrigger className="h-8 w-24 text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {yearOptions.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CalendarComponent
          mode="single"
          hideNavigation
          showOutsideDays={false}
          selected={selectedDate}
          month={displayMonth}
          onMonthChange={setDisplayMonth}
          onSelect={(date) => {
            if (!date) return;
            onChange(getSalesDateInputValue(date));
            setOpen(false);
          }}
          defaultMonth={selectedDate ?? minCalendarDate ?? new Date()}
          disabled={minCalendarDate ? (date) => date < minCalendarDate : undefined}
          formatters={{
            formatWeekdayName: (date) => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()],
          }}
          className="w-full rounded-none border-0 bg-white px-3 pb-3 pt-2"
          classNames={compactCalendarClassNames}
        />
        {value && (
          <div className="flex justify-end border-t px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => onChange('')}
            >
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function DateRangeCalendarFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  inline = false,
}: {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  inline?: boolean;
}) {
  const setStartDateValue = (value: string) => {
    onStartDateChange(value);
    if (value && endDate && parseSalesCalendarDate(endDate) < parseSalesCalendarDate(value)) {
      onEndDateChange('');
    }
  };

  return (
    <div className={cn(inline ? 'flex items-center gap-1.5' : 'grid grid-cols-2 gap-2')}>
      <DateFilterButton
        label="From"
        value={startDate}
        onChange={setStartDateValue}
        className={inline ? 'w-[116px]' : 'w-full'}
      />
      <DateFilterButton
        label="To"
        value={endDate}
        onChange={onEndDateChange}
        minDate={startDate}
        className={inline ? 'w-[116px]' : 'w-full'}
      />
    </div>
  );
}

function CreatableCombobox({
  value, onChange, options, placeholder,
}: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const filtered = options.filter((o) => o.toLowerCase().includes(inputValue.toLowerCase()));

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setInputValue('');
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal min-w-0">
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start" sideOffset={4}>
        <Command>
          <CommandInput
            placeholder="Search or type..."
            value={inputValue}
            onValueChange={(v) => { setInputValue(v); onChange(v); }}
          />
          <CommandList className="max-h-[180px]">
            {filtered.length === 0 && inputValue && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                Press Enter to use &quot;<strong>{inputValue}</strong>&quot;
              </div>
            )}
            <CommandGroup>
              {filtered.map((opt) => (
                <CommandItem key={opt} value={opt} onSelect={() => { onChange(opt); setInputValue(''); setOpen(false); }}>
                  <Check className={cn('mr-2 h-4 w-4', value === opt ? 'opacity-100' : 'opacity-0')} />{opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Client combobox ─────────────────────────────────────────────────────────

function ClientCombobox({
  value, onChange, options,
}: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{value || 'Select client...'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start" sideOffset={4}>
        <Command>
          <CommandInput placeholder="Search client..." />
          <CommandList className="max-h-[200px]">
            <CommandEmpty>No client found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem key={opt} value={opt} onSelect={() => { onChange(opt); setOpen(false); }}>
                  <Check className={cn('mr-2 h-4 w-4', value === opt ? 'opacity-100' : 'opacity-0')} />{opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Collapsible client row ───────────────────────────────────────────────────

function ClientGroupRow({
  group, colSpan, isAdmin, onPaymentClick, handleDeleteSale, handleDeleteGroup, router,
}: {
  group: ClientGroup; colSpan: number; isAdmin: boolean;
  onPaymentClick: (group: ClientGroup) => void;
  handleDeleteSale: (id: string) => void;
  handleDeleteGroup: (group: ClientGroup) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [open, setOpen] = useState(false);

  const paymentBadge = (() => {
    const status = group.paymentStatus || 'unpaid';
    let cls = ''; let label = '';
    if (status === 'paid') {
      cls = 'bg-green-100 text-green-800 border-green-300';
      label = 'PAID';
    } else if (status === 'unpaid') {
      cls = 'bg-red-100 text-red-800 border-red-300';
      label = 'UNPAID';
    } else {
      cls = 'bg-orange-100 text-orange-800 border-orange-300';
      const balance = Math.max(0, group.groupTotal - (group.amountPaid ?? 0));
      label = `PARTIAL ${formatCurrency(balance)}`;
    }
    return (
      <Badge
        variant="outline"
        className={`${cls} text-xs cursor-pointer hover:opacity-80`}
        onClick={(e) => { e.stopPropagation(); onPaymentClick(group); }}
      >
        {label}
      </Badge>
    );
  })();

  return (
    <>
      <TableRow
        className="bg-primary/5 border-t-2 border-primary/20 hover:bg-primary/10 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <TableCell colSpan={colSpan} className="py-2.5 px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 flex items-center justify-center text-primary">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
              <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm leading-tight">{group.clientName}</p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span>{formatSaleDate(group.saleDate)}</span>
                  {group.voucherType && <><span className="opacity-40">|</span><span>{group.voucherType}</span></>}
                  {group.voucherNo && <><span className="opacity-40">|</span><span className="font-mono">{group.voucherNo}</span></>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {paymentBadge}
              <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {group.records.length} item{group.records.length !== 1 ? 's' : ''}
              </Badge>
              <span className="font-semibold text-sm">{formatCurrency(group.groupTotal)}</span>
              {isAdmin && (
                <div onClick={(e) => e.stopPropagation()}>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Client Record</AlertDialogTitle>
                        <AlertDialogDescription>
                          Delete all {group.records.length} item{group.records.length !== 1 ? 's' : ''} for <strong>{group.clientName}</strong>? Quantity will be restored.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteGroup(group)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          </div>
        </TableCell>
      </TableRow>

      {open && (
        <>
          {group.records.map((record, idx) => {
            const productionCostTotal = (record.productionCostPerUnit ?? 0) * record.quantitySold;
            const isFree = record.sellingPricePerUnit === 0;
            return (
              <TableRow key={record.id} className="hover:bg-muted/20 bg-white animate-in fade-in slide-in-from-top-1 duration-150">
                <TableCell className="text-muted-foreground text-xs pl-14">{idx + 1}</TableCell>
                <TableCell className="font-medium text-sm">{record.productName}</TableCell>
                <TableCell className="text-right text-sm">{record.quantitySold}</TableCell>
                <TableCell className="text-right text-sm">
                  {isFree
                    ? <Badge variant="secondary" className="bg-blue-100 text-blue-800">FREE</Badge>
                    : formatCurrency(record.sellingPricePerUnit)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {record.discount > 0
                    ? <span className="text-green-600">{record.discount}</span>
                    : <span className="text-muted-foreground">0</span>}
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right font-medium text-sm">
                    {isFree
                      ? <Badge variant="secondary" className="bg-blue-100 text-blue-800">FREE</Badge>
                      : formatCurrency(record.totalAmount)}
                  </TableCell>
                )}
                {isAdmin && (
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatCurrency(productionCostTotal)}
                  </TableCell>
                )}
                {isAdmin && (
                  <TableCell className="text-right text-sm">
                    {isFree ? (
                      <span className="text-muted-foreground text-xs">N/A</span>
                    ) : (
                      <span className={`font-semibold ${record.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {record.profit >= 0
                          ? <ArrowUpRight className="h-3.5 w-3.5 inline mr-0.5" />
                          : <ArrowDownRight className="h-3.5 w-3.5 inline mr-0.5" />}
                        {formatCurrency(Math.abs(record.profit))}
                      </span>
                    )}
                  </TableCell>
                )}
                {isAdmin && (
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => router.push(`/sales/${record.id}/edit`)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Sales Record</AlertDialogTitle>
                            <AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteSale(record.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          <TableRow className="bg-muted/30 border-b-2 border-muted/60">
            <TableCell colSpan={5} className="pl-14 py-1.5 text-xs text-muted-foreground">
              {group.records.length} item{group.records.length !== 1 ? 's' : ''} for {group.clientName}
            </TableCell>
            {isAdmin && (
              <TableCell className="text-right font-semibold text-sm py-1.5">{formatCurrency(group.groupTotal)}</TableCell>
            )}
            {isAdmin && (
              <TableCell className="text-right text-xs text-muted-foreground py-1.5">
                {formatCurrency(group.records.reduce((s, r) => s + (r.productionCostPerUnit ?? 0) * r.quantitySold, 0))}
              </TableCell>
            )}
            {isAdmin && (
              <TableCell className="text-right py-1.5">
                <span className={`text-xs font-semibold ${group.groupProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(group.groupProfit)}
                </span>
              </TableCell>
            )}
            {isAdmin && <TableCell />}
          </TableRow>
        </>
      )}
    </>
  );
}

/* ================================================================
   MAIN COMPONENT
================================================================ */
export default function SalesSummary() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Month / Year multi-select ─────────────────────────────────────────────
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);

  // ── Other filters ─────────────────────────────────────────────────────────
  const [productFilters, setProductFilters] = useState<string[]>([]);
  const [clientFilters, setClientFilters] = useState<string[]>([]);
  const [clientNameOrder, setClientNameOrder] = useState<ClientNameOrder>('latest');
  const [paymentStatusFilters, setPaymentStatusFilters] = useState<string[]>([]);
  const [cityFilters, setCityFilters] = useState<string[]>([]);
  const [salesmanFilters, setSalesmanFilters] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  // ── Client meta ───────────────────────────────────────────────────────────
  const [clientMetas, setClientMetas] = useState<ClientMeta[]>([]);

  // ── Maintenance modal ─────────────────────────────────────────────────────
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintClient, setMaintClient] = useState('');
  const [maintCity, setMaintCity] = useState('');
  const [maintSalesman, setMaintSalesman] = useState('');
  const [isSavingMaint, setIsSavingMaint] = useState(false);

  // ── Payment modal ─────────────────────────────────────────────────────────
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ClientGroup | null>(null);
  const [additionalAmount, setAdditionalAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // ── Fetch records ─────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('paymentRaw', '1');
      if (cityFilters.length === 1) params.set('city', cityFilters[0]);
      if (salesmanFilters.length === 1) params.set('salesman', salesmanFilters[0]);
      const res = await fetch(`/api/sales/records?${params.toString()}`);
      if (!res.ok) throw new Error();
      setSalesRecords(await res.json());
    } catch {
      toast.error('Failed to load sales records.');
    } finally {
      setLoading(false);
    }
  }, [cityFilters, salesmanFilters]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const fetchClientMetas = useCallback(async () => {
    try {
      const res = await fetch('/api/clients/meta');
      if (res.ok) setClientMetas(await res.json());
    } catch { }
  }, []);
  useEffect(() => { fetchClientMetas(); }, [fetchClientMetas]);

  // ── Available years ───────────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    salesRecords.forEach((r) => years.add(parseSalesCalendarDate(r.saleDate).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [salesRecords]);

  // ── Filter options ────────────────────────────────────────────────────────
  const uniqueProducts = useMemo(
    () => [...new Set(salesRecords.map((r) => r.productName))].sort(),
    [salesRecords],
  );
  const uniqueClients = useMemo(
    () => [...new Set(salesRecords.map((r) => r.clientName?.trim()).filter((c): c is string => !!c))].sort(),
    [salesRecords],
  );
  const uniqueCities = useMemo(
    () => [...new Set(clientMetas.map((m) => m.city).filter((c): c is string => !!c))].sort(),
    [clientMetas],
  );
  const uniqueSalesmen = useMemo(
    () => [...new Set(clientMetas.map((m) => m.salesman).filter((s): s is string => !!s))].sort(),
    [clientMetas],
  );
  const clientMetaMap = useMemo(() => {
    const map = new Map<string, ClientMeta>();
    clientMetas.forEach((m) => map.set(m.clientName, m));
    return map;
  }, [clientMetas]);

  // ── Apply all filters ─────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    const startBoundary = startDate ? getDateFilterBoundary(startDate) : null;
    const endBoundary = endDate ? getDateFilterBoundary(endDate, true) : null;

    return salesRecords.filter((r) => {
      const d = parseSalesCalendarDate(r.saleDate);
      if (selectedYears.length > 0 && !selectedYears.includes(d.getFullYear())) return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(d.getMonth())) return false;
      if (productFilters.length > 0 && !productFilters.includes(r.productName)) return false;
      if (clientFilters.length > 0 && !clientFilters.includes(r.clientName?.trim() ?? '')) return false;
      if (cityFilters.length > 0) {
        const meta = clientMetaMap.get(r.clientName?.trim() ?? '');
        if (!meta?.city || !cityFilters.includes(meta.city)) return false;
      }
      if (salesmanFilters.length > 0) {
        const meta = clientMetaMap.get(r.clientName?.trim() ?? '');
        if (!meta?.salesman || !salesmanFilters.includes(meta.salesman)) return false;
      }
      if (startBoundary && d < startBoundary) return false;
      if (endBoundary && d > endBoundary) return false;
      return true;
    });
  }, [
    salesRecords, selectedMonths, selectedYears,
    productFilters, clientFilters, cityFilters, salesmanFilters,
    startDate, endDate, clientMetaMap,
  ]);

  const clientGroups = useMemo(() => {
    let groups = groupByClient(filteredRecords);
    if (paymentStatusFilters.length > 0) {
      const selectedStatuses = new Set(paymentStatusFilters.map((status) => PAYMENT_STATUS_VALUES[status]));
      groups = groups.filter((group) => selectedStatuses.has(group.paymentStatus ?? 'unpaid'));
    }
    if (clientNameOrder === 'latest') return groups;

    return [...groups].sort((a, b) => {
      const comparison = a.clientName.localeCompare(b.clientName, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return clientNameOrder === 'az' ? comparison : -comparison;
    });
  }, [filteredRecords, clientNameOrder, paymentStatusFilters]);
  const clientGroupsPagination = usePaginatedRecords(clientGroups);
  const paginatedClientGroups = clientGroupsPagination.paginatedRecords;
  const pageRecords = useMemo(() => paginatedClientGroups.flatMap((g) => g.records), [paginatedClientGroups]);
  const pageSummary = useMemo(() => calculateSalesSummary(pageRecords), [pageRecords]);
  const allRecords = useMemo(() => clientGroups.flatMap((g) => g.records), [clientGroups]);
  const summary = useMemo(() => calculateSalesSummary(allRecords), [allRecords]);

  // ── Average revenue ───────────────────────────────────────────────────────
  const { avgRevenue, avgLabel } = useMemo(() => {
    if (selectedMonths.length === 1 && selectedYears.length <= 1) {
      const days = new Set(allRecords.map((r) => getSalesDateKey(r.saleDate)));
      const count = days.size;
      return { avgRevenue: count > 0 ? summary.totalRevenue / count : 0, avgLabel: 'Avg / Day' };
    }
    const months = new Set(
      allRecords.map((r) => {
        const d = parseSalesCalendarDate(r.saleDate);
        return `${d.getFullYear()}-${d.getMonth()}`;
      }),
    );
    const count = months.size;
    return { avgRevenue: count > 0 ? summary.totalRevenue / count : 0, avgLabel: 'Avg / Month' };
  }, [allRecords, summary.totalRevenue, selectedMonths, selectedYears]);

  const hasActiveFilters =
    selectedMonths.length > 0 || selectedYears.length > 0 ||
    productFilters.length > 0 || clientFilters.length > 0 ||
    cityFilters.length > 0 || salesmanFilters.length > 0 ||
    paymentStatusFilters.length > 0 ||
    clientNameOrder !== 'latest' ||
    !!startDate || !!endDate;

  const clearFilters = () => {
    setProductFilters([]); setClientFilters([]);
    setClientNameOrder('latest');
    setSelectedMonths([]); setSelectedYears([]);
    setPaymentStatusFilters([]);
    setCityFilters([]); setSalesmanFilters([]);
    setStartDate(''); setEndDate(''); setFilterOpen(false);
  };

  const activeFilterChips: Array<{ key: string; label: string; onRemove: () => void }> = [
    ...clientFilters.map((value) => ({
      key: `client-${value}`,
      label: `Client: ${value}`,
      onRemove: () => setClientFilters((prev) => prev.filter((item) => item !== value)),
    })),
    ...(clientNameOrder !== 'latest'
      ? [{
        key: 'client-order',
        label: `Order: ${CLIENT_NAME_ORDER_LABELS[clientNameOrder]}`,
        onRemove: () => setClientNameOrder('latest'),
      }]
      : []),
    ...paymentStatusFilters.map((value) => ({
      key: `payment-${value}`,
      label: `Payment: ${value}`,
      onRemove: () => setPaymentStatusFilters((prev) => prev.filter((item) => item !== value)),
    })),
    ...productFilters.map((value) => ({
      key: `product-${value}`,
      label: `Product: ${value}`,
      onRemove: () => setProductFilters((prev) => prev.filter((item) => item !== value)),
    })),
    ...cityFilters.map((value) => ({
      key: `city-${value}`,
      label: `City: ${value}`,
      onRemove: () => setCityFilters((prev) => prev.filter((item) => item !== value)),
    })),
    ...salesmanFilters.map((value) => ({
      key: `salesman-${value}`,
      label: `Salesman: ${value}`,
      onRemove: () => setSalesmanFilters((prev) => prev.filter((item) => item !== value)),
    })),
    ...(startDate ? [{ key: 'start-date', label: `From: ${startDate}`, onRemove: () => setStartDate('') }] : []),
    ...(endDate ? [{ key: 'end-date', label: `To: ${endDate}`, onRemove: () => setEndDate('') }] : []),
  ];
  const activeFilterCount = activeFilterChips.length + selectedYears.length + selectedMonths.length;

  // ── Maintenance ───────────────────────────────────────────────────────────
  const openMaintenance = () => {
    setMaintClient(''); setMaintCity(''); setMaintSalesman('');
    setMaintenanceOpen(true);
  };
  const handleMaintClientChange = (name: string) => {
    setMaintClient(name);
    const existing = clientMetaMap.get(name);
    setMaintCity(existing?.city ?? '');
    setMaintSalesman(existing?.salesman ?? '');
  };
  const saveMaintenance = async () => {
    if (!maintClient) { toast.error('Please select a client'); return; }
    try {
      setIsSavingMaint(true);
      const res = await fetch('/api/clients/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: maintClient, city: maintCity, salesman: maintSalesman }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Saved for ${maintClient}`);
      await fetchClientMetas();
      setMaintClient(''); setMaintCity(''); setMaintSalesman('');
    } catch { toast.error('Failed to save'); }
    finally { setIsSavingMaint(false); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteSale = async (saleId: string) => {
    try {
      const res = await fetch(`/api/sales/records/${saleId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete');
      toast.success('Sales record deleted');
      fetchRecords();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to delete'); }
  };

  const handleDeleteClientGroup = async (group: ClientGroup) => {
    try {
      for (const record of group.records) {
        const res = await fetch(`/api/sales/records/${record.id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || 'Failed to delete client record');
        }
      }
      toast.success(`Deleted ${group.records.length} item${group.records.length !== 1 ? 's' : ''} for ${group.clientName}`);
      fetchRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete client record');
    }
  };

  // ── Payment modal ─────────────────────────────────────────────────────────
  const openPaymentModal = (group: ClientGroup) => {
    setSelectedGroup(group);
    setAdditionalAmount('');
    setPaymentNote('');
    setPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setPaymentModalOpen(false);
    setSelectedGroup(null);
    setAdditionalAmount('');
    setPaymentNote('');
  };

  const savePaymentStatus = async () => {
    if (!selectedGroup) return;

    const addedAmount = parseFloat(additionalAmount);
    if (isNaN(addedAmount) || addedAmount <= 0) {
      toast.error('Please enter a valid amount greater than 0');
      return;
    }

    const previouslyPaid = selectedGroup.amountPaid ?? 0;
    const maxAdditional = selectedGroup.groupTotal - previouslyPaid;

    if (addedAmount > maxAdditional) {
      toast.error(`Max additional payment: ${formatCurrency(maxAdditional)}`);
      return;
    }

    const newTotalPaid = previouslyPaid + addedAmount;
    const newBalance = selectedGroup.groupTotal - newTotalPaid;
    const newStatus: 'paid' | 'partial' = newBalance <= 0 ? 'paid' : 'partial';

    try {
      setIsSavingPayment(true);

      // Audit log — record this payment installment
      await fetch('/api/sales/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesRecordId: selectedGroup.records[0].id,
          action: 'payment',
          changes: {
            productName: selectedGroup.voucherNo
              ? `Invoice ${selectedGroup.voucherNo}`
              : `${selectedGroup.records.length} item${selectedGroup.records.length !== 1 ? 's' : ''}`,
            clientName: selectedGroup.clientName,
            saleDate: selectedGroup.saleDate,
            voucherNo: selectedGroup.voucherNo || null,
            changes: [
              {
                field: 'paymentInstallment',
                oldValue: previouslyPaid,
                newValue: newTotalPaid,
                note: `Received ${formatCurrency(addedAmount)}${paymentNote ? ` — ${paymentNote}` : ''}`,
              },
              {
                field: 'paymentStatus',
                oldValue: selectedGroup.paymentStatus ?? 'unpaid',
                newValue: newStatus,
              },
              {
                field: 'balance',
                oldValue: selectedGroup.groupTotal - previouslyPaid,
                newValue: newBalance,
              },
            ],
          },
        }),
      });

      // Update each record proportionally
      await Promise.all(
        selectedGroup.records.map((record) => {
          const proportion =
            selectedGroup.groupTotal > 0
              ? record.totalAmount / selectedGroup.groupTotal
              : 1 / selectedGroup.records.length;
          const recordAmountPaid = parseFloat((newTotalPaid * proportion).toFixed(2));
          const recordAmountDue = parseFloat(Math.max(0, record.totalAmount - recordAmountPaid).toFixed(2));
          return fetch(`/api/sales/records/${record.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentStatus: newStatus,
              amountPaid: recordAmountPaid,
              amountDue: recordAmountDue,
              paymentNote: paymentNote.trim() || null,
              skipAuditLog: true,
            }),
          });
        }),
      );

      toast.success(
        newStatus === 'paid'
          ? `Invoice fully paid — ${formatCurrency(selectedGroup.groupTotal)}`
          : `Payment of ${formatCurrency(addedAmount)} recorded. Balance: ${formatCurrency(newBalance)}`,
      );
      closePaymentModal();
      fetchRecords();
    } catch {
      toast.error('Failed to update payment status');
    } finally {
      setIsSavingPayment(false);
    }
  };

  // ── PDF download ──────────────────────────────────────────────────────────
  const handleDownloadPDF = () => {
    const monthLabel = selectedMonths.length > 0
      ? `${selectedMonths.map((m) => MONTH_NAMES[m]).join(', ')}${selectedYears.length > 0 ? ' ' + selectedYears.join(', ') : ''}`
      : 'All Months';

    const filterTags = [
      selectedMonths.length > 0 ? `Months: ${selectedMonths.map((m) => MONTH_NAMES[m]).join(', ')}` : null,
      selectedYears.length > 0 ? `Years: ${selectedYears.join(', ')}` : null,
      productFilters.length > 0 ? `Products: ${productFilters.join(', ')}` : null,
      clientFilters.length > 0 ? `Clients: ${clientFilters.join(', ')}` : null,
      clientNameOrder !== 'latest' ? `Client order: ${CLIENT_NAME_ORDER_LABELS[clientNameOrder]}` : null,
      paymentStatusFilters.length > 0 ? `Payment: ${paymentStatusFilters.join(', ')}` : null,
      cityFilters.length > 0 ? `Cities: ${cityFilters.join(', ')}` : null,
      salesmanFilters.length > 0 ? `Salesmen: ${salesmanFilters.join(', ')}` : null,
      startDate ? `From: ${startDate}` : null,
      endDate ? `To: ${endDate}` : null,
    ].filter(Boolean);

    const pdfColumnCount = isAdmin ? 8 : 7;
    const profitStatHtml = isAdmin
      ? `<div class="stat-box"><div class="stat-label">Profit</div><div class="stat-value ${summary.totalProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(summary.totalProfit)}</div></div>`
      : '';
    const statsHtml = `
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-label">Total Sales</div><div class="stat-value">${summary.salesCount}</div></div>
        <div class="stat-box"><div class="stat-label">Revenue</div><div class="stat-value">${formatCurrency(summary.totalRevenue)}</div></div>
        <div class="stat-box"><div class="stat-label">Qty Sold</div><div class="stat-value">${summary.totalQuantity} pkts</div></div>
        ${profitStatHtml}
        <div class="stat-box"><div class="stat-label">${avgLabel}</div><div class="stat-value">${formatCurrency(avgRevenue)}</div></div>
      </div>`;

    const rows = clientGroups.map((group) => {
      const meta = clientMetaMap.get(group.clientName);
      const productRows = group.records.map((r, idx) => `
        <tr>
          <td class="indent">${idx + 1}</td><td>${r.productName}</td>
          <td class="right">${r.quantitySold}</td>
          <td class="right">${formatCurrency(r.sellingPricePerUnit)}</td>
          <td class="right">${r.discount > 0 ? r.discount + '%' : '—'}</td>
          <td class="right">${formatCurrency(r.totalAmount)}</td>
          <td class="right">${formatCurrency((r.productionCostPerUnit ?? 0) * r.quantitySold)}</td>
          ${isAdmin ? `<td class="right ${r.profit >= 0 ? 'profit' : 'loss'}">${formatCurrency(r.profit)}</td>` : ''}
        </tr>`).join('');
      const payStatus = group.paymentStatus || 'unpaid';
      const balance = Math.max(0, group.groupTotal - (group.amountPaid ?? 0));
      const payLabel2 = payStatus === 'paid'
        ? 'PAID'
        : payStatus === 'unpaid'
          ? 'UNPAID'
          : `PARTIAL ${formatCurrency(balance)}`;
      return `
        <tr class="group-header"><td colspan="${pdfColumnCount}">
          <div class="group-row">
            <div>
              <strong>${group.clientName}</strong>
              ${meta?.city ? `<span class="tag">${meta.city}</span>` : ''}
              ${meta?.salesman ? `<span class="tag">${meta.salesman}</span>` : ''}
              <span class="meta">${formatSaleDate(group.saleDate)}${group.voucherType ? ' · ' + group.voucherType : ''}${group.voucherNo ? ' · ' + group.voucherNo : ''}</span>
            </div>
            <div class="group-right"><span class="badge ${payStatus}">${payLabel2}</span><strong>${formatCurrency(group.groupTotal)}</strong></div>
          </div>
        </td></tr>
        ${productRows}
        <tr class="subtotal">
          <td colspan="5" class="indent-label">${group.records.length} item${group.records.length !== 1 ? 's' : ''}</td>
          <td class="right"><strong>${formatCurrency(group.groupTotal)}</strong></td>
          <td class="right muted">${formatCurrency(group.records.reduce((s, r) => s + (r.productionCostPerUnit ?? 0) * r.quantitySold, 0))}</td>
          ${isAdmin ? `<td class="right ${group.groupProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(group.groupProfit)}</td>` : ''}
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Sales — ${monthLabel}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:20px}
      h1{font-size:18px;margin-bottom:4px}
      .meta-line{font-size:11px;color:#666;margin-bottom:8px}
      .filter-tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px}
      .filter-tag{font-size:10px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:4px;padding:2px 6px;color:#374151}
      .stats-grid{display:grid;grid-template-columns:repeat(${isAdmin ? 5 : 4},1fr);gap:8px;margin-bottom:16px}
      .stat-box{background:#f8f8f6;border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px}
      .stat-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
      .stat-value{font-size:15px;font-weight:700;color:#111}
      table{width:100%;border-collapse:collapse}
      th{background:#f3f4f6;text-align:left;padding:7px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e5e7eb}
      th.right,td.right{text-align:right}
      td{padding:6px 8px;border-bottom:1px solid #f0f0f0}
      .group-header td{background:#f8f6f2;border-top:2px solid #d4c5a9;padding:8px}
      .group-row{display:flex;justify-content:space-between;align-items:center}
      .group-right{display:flex;align-items:center;gap:12px}
      .meta{font-size:10px;color:#888;margin-left:8px}
      .tag{font-size:10px;color:#555;background:#e5e7eb;border-radius:3px;padding:1px 5px;margin-left:4px}
      .indent{padding-left:24px;color:#999}
      .indent-label{padding-left:24px;color:#888;font-size:10px}
      .subtotal td{background:#f9fafb}
      .badge{font-size:10px;padding:2px 7px;border-radius:4px;font-weight:600}
      .paid{background:#dcfce7;color:#166534}
      .unpaid{background:#fee2e2;color:#991b1b}
      .partial{background:#ffedd5;color:#9a3412}
      .profit{color:#16a34a}.loss{color:#dc2626}.muted{color:#888}
      .grand{background:#f3f4f6;font-weight:700;border-top:2px solid #ccc}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>Sales Records — ${monthLabel}</h1>
    <p class="meta-line">Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · ${clientGroups.length} clients · ${allRecords.length} records</p>
    ${filterTags.length > 0 ? `<div class="filter-tags">${filterTags.map((t) => `<span class="filter-tag">${t}</span>`).join('')}</div>` : ''}
    ${statsHtml}
    <table><thead><tr>
      <th>#</th><th>Product</th>
      <th class="right">Packets</th><th class="right">Price/Pkt</th>
      <th class="right">Discount</th><th class="right">Final Amt</th>
      <th class="right">Prod. Cost</th>${isAdmin ? '<th class="right">Profit/Loss</th>' : ''}
    </tr></thead><tbody>
      ${rows}
      <tr class="grand">
        <td colspan="5">Grand Total — ${clientGroups.length} client${clientGroups.length !== 1 ? 's' : ''} · ${allRecords.length} records</td>
        <td class="right">${formatCurrency(summary.totalRevenue)}</td>
        <td class="right muted">${formatCurrency(allRecords.reduce((s, r) => s + (r.productionCostPerUnit ?? 0) * r.quantitySold, 0))}</td>
        ${isAdmin ? `<td class="right ${summary.totalProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(summary.totalProfit)}</td>` : ''}
      </tr>
    </tbody></table></body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const totalColSpan = 5 + (isAdmin ? 2 : 0) + (isAdmin ? 1 : 0) + (isAdmin ? 1 : 0);

  const FilterIconPopover = ({
    label,
    icon: Icon,
    active,
    contentClassName,
    children,
  }: {
    label: string;
    icon: LucideIcon;
    active?: boolean;
    contentClassName?: string;
    children: ReactNode;
  }) => (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label={label}
              className={cn('relative h-9 w-9', active && 'border-primary text-primary')}
            >
              <Icon className="h-4 w-4" />
              {active && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent className={cn('w-72 p-3', contentClassName)} align="start">
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );

  const FilterContent = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Client</Label>
          <MultiSelectFilter className="w-full" label="Client" values={clientFilters} onChange={setClientFilters} options={uniqueClients} placeholder="All Clients" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Client Name Order</Label>
            <Select value={clientNameOrder} onValueChange={(value) => setClientNameOrder(value as ClientNameOrder)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Default</SelectItem>
                <SelectItem value="az">A-Z</SelectItem>
                <SelectItem value="za">Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Payment Status</Label>
            <MultiSelectFilter className="w-full" label="Payment Status" values={paymentStatusFilters} onChange={setPaymentStatusFilters} options={PAYMENT_STATUS_OPTIONS} placeholder="All Payments" />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Product</Label>
          <MultiSelectFilter className="w-full" label="Product" values={productFilters} onChange={setProductFilters} options={uniqueProducts} placeholder="All Products" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">City</Label>
            <MultiSelectFilter className="w-full" label="City" values={cityFilters} onChange={setCityFilters} options={uniqueCities} placeholder="All Cities" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Salesman</Label>
            <MultiSelectFilter className="w-full" label="Salesman" values={salesmanFilters} onChange={setSalesmanFilters} options={uniqueSalesmen} placeholder="All Salesmen" />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Date Range</Label>
          <DateRangeCalendarFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
        </div>
      </div>

      {activeFilterChips.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <div className="flex flex-wrap gap-2">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onRemove}
                className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                <span className="truncate">{chip.label}</span>
                <X className="h-3 w-3 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {hasActiveFilters && (
        <Button variant="outline" onClick={clearFilters} className="w-full gap-2">
          <X className="h-4 w-4" />Clear Filters
        </Button>
      )}
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 overflow-x-auto">
          <div className="shrink-0">
            <h1 className="text-2xl font-bold whitespace-nowrap">Sales Summary</h1>
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              View and analyze sales records
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
            <Button variant="outline" onClick={() => router.push('/sales/history')} className="gap-2 shrink-0">
              <History className="h-4 w-4" />Sales History
            </Button>
            <Button variant="outline" onClick={openMaintenance} className="gap-2 shrink-0">
              <Settings2 className="h-4 w-4" />Sales Maintenance
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={loading || allRecords.length === 0}
              className="gap-2 shrink-0"
            >
              <Download className="h-4 w-4" />Download PDF
            </Button>
            <Button variant="outline" onClick={() => router.push('/sales/upload')} className="gap-2 shrink-0">
              <Upload className="h-4 w-4" />Upload
            </Button>
            <Button onClick={() => router.push('/sales/new')} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />New Sale
            </Button>
          </div>
        </div>

        {/* ── Year + Month multi-select ── */}
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex flex-col gap-3">

              {/* Year row */}
              {availableYears.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium w-10 shrink-0">Year</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {availableYears.map((y) => {
                      const isSelected = selectedYears.includes(y);
                      return (
                        <button
                          key={y}
                          onClick={() =>
                            setSelectedYears((prev) =>
                              prev.includes(y) ? prev.filter((v) => v !== y) : [...prev, y],
                            )
                          }
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:border-border',
                          )}
                        >
                          {y}
                        </button>
                      );
                    })}
                    {selectedYears.length > 0 && (
                      <button
                        onClick={() => setSelectedYears([])}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-1"
                      >
                        <X className="h-3 w-3" /> Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Month row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-medium w-10 shrink-0">Month</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {MONTH_NAMES.map((name, idx) => {
                    const relevantYears = selectedYears.length > 0 ? selectedYears : availableYears;
                    const hasData = salesRecords.some((r) => {
                      const d = parseSalesCalendarDate(r.saleDate);
                      return relevantYears.includes(d.getFullYear()) && d.getMonth() === idx;
                    });
                    const isSelected = selectedMonths.includes(idx);
                    return (
                      <button
                        key={name}
                        onClick={() => {
                          if (!hasData) return;
                          setSelectedMonths((prev) =>
                            prev.includes(idx) ? prev.filter((v) => v !== idx) : [...prev, idx],
                          );
                        }}
                        disabled={!hasData}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium transition-all border relative',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : hasData
                              ? 'bg-muted/50 text-foreground border-transparent hover:bg-muted hover:border-border'
                              : 'bg-muted/20 text-muted-foreground/40 border-transparent cursor-not-allowed',
                        )}
                      >
                        {name}
                        {hasData && !isSelected && (
                          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                  {selectedMonths.length > 0 && (
                    <button
                      onClick={() => setSelectedMonths([])}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-1"
                    >
                      <X className="h-3 w-3" /> Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Active selection summary */}
              {(selectedMonths.length > 0 || selectedYears.length > 0) && (
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <div className="flex flex-wrap gap-1">
                    {selectedYears.map((y) => (
                      <Badge
                        key={y}
                        variant="secondary"
                        className="text-xs gap-1 cursor-pointer"
                        onClick={() => setSelectedYears((prev) => prev.filter((v) => v !== y))}
                      >
                        {y}<X className="h-3 w-3" />
                      </Badge>
                    ))}
                    {selectedMonths.map((m) => (
                      <Badge
                        key={m}
                        variant="secondary"
                        className="text-xs gap-1 cursor-pointer"
                        onClick={() => setSelectedMonths((prev) => prev.filter((v) => v !== m))}
                      >
                        {MONTH_NAMES[m]}<X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{allRecords.length} records</span>
                </div>
              )}

            </div>
          </CardContent>
        </Card>

        {/* Stats — 5 boxes */}
        {loading ? (
          <div className={cn('grid grid-cols-2 gap-4', isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
            {[...Array(isAdmin ? 5 : 4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-8 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className={cn('grid grid-cols-2 gap-4', isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
            <StatCard title="Total Sales" value={summary.salesCount.toString()} icon={Package} />
            <StatCard title="Revenue" value={formatCurrency(summary.totalRevenue)} icon={IndianRupee} />
            <StatCard title="Qty Sold" value={`${summary.totalQuantity} packets`} icon={TrendingUp} />
            {isAdmin && (
              <StatCard title="Profit" value={formatCurrency(summary.totalProfit)} icon={TrendingUp} />
            )}
            <StatCard title={avgLabel} value={formatCurrency(avgRevenue)} icon={BarChart3} />
          </div>
        )}

        {/* Desktop filter bar */}
        <Card className="hidden md:block">
          <CardContent className="flex flex-wrap items-center gap-2 p-2">
            <TooltipProvider delayDuration={150}>
              <div className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-muted/50 px-2 text-xs font-medium text-muted-foreground">
                <Filter className="h-4 w-4 text-primary" />
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <MultiSelectFilter
                      iconOnly
                      icon={User}
                      label="Client"
                      values={clientFilters}
                      onChange={setClientFilters}
                      options={uniqueClients}
                      placeholder="All Clients"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Client</TooltipContent>
              </Tooltip>

              <FilterIconPopover label="Client Order" icon={ChevronsUpDown} active={clientNameOrder !== 'latest'}>
                <Select value={clientNameOrder} onValueChange={(value) => setClientNameOrder(value as ClientNameOrder)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">Default</SelectItem>
                    <SelectItem value="az">A-Z</SelectItem>
                    <SelectItem value="za">Z-A</SelectItem>
                  </SelectContent>
                </Select>
              </FilterIconPopover>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <MultiSelectFilter
                      iconOnly
                      icon={CreditCard}
                      label="Payment Status"
                      values={paymentStatusFilters}
                      onChange={setPaymentStatusFilters}
                      options={PAYMENT_STATUS_OPTIONS}
                      placeholder="All Payments"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Payment Status</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <MultiSelectFilter
                      iconOnly
                      icon={Package}
                      label="Product"
                      values={productFilters}
                      onChange={setProductFilters}
                      options={uniqueProducts}
                      placeholder="All Products"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Product</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <MultiSelectFilter
                      iconOnly
                      icon={MapPin}
                      label="City"
                      values={cityFilters}
                      onChange={setCityFilters}
                      options={uniqueCities}
                      placeholder="All Cities"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>City</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <MultiSelectFilter
                      iconOnly
                      icon={BriefcaseBusiness}
                      label="Salesman"
                      values={salesmanFilters}
                      onChange={setSalesmanFilters}
                      options={uniqueSalesmen}
                      placeholder="All Salesmen"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Salesman</TooltipContent>
              </Tooltip>

              <DateRangeCalendarFilter
                inline
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
              />

              {hasActiveFilters && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={clearFilters} className="h-9 w-9">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear Filters</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>

            {activeFilterChips.length > 0 && (
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onRemove}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted"
                  >
                    <span className="truncate">{chip.label}</span>
                    <X className="h-3 w-3 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mobile filter */}
        <div className="md:hidden">
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="w-full gap-2">
                <Filter className="h-4 w-4" />Filters
                {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  Filter Sales
                  {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4"><FilterContent /></div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop table */}
        <Card className="hidden md:block">
          <CardHeader>
            <CardTitle>Sales Records</CardTitle>
            <CardDescription>
              {clientGroups.length} client{clientGroups.length !== 1 ? 's' : ''} · {allRecords.length} line item{allRecords.length !== 1 ? 's' : ''}
              {(selectedMonths.length > 0 || selectedYears.length > 0) && (
                ` · ${[
                  ...selectedYears.map(String),
                  ...selectedMonths.map((m) => MONTH_NAMES[m]),
                ].join(', ')}`
              )}
              <span className="text-muted-foreground/60 text-xs"> · Click a client row to expand</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : clientGroups.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                {salesRecords.length === 0 ? 'No sales records found' : 'No records match the current filters'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Packets</TableHead>
                      <TableHead className="text-right">Price / Pkt</TableHead>
                      <TableHead className="text-right">Discount %</TableHead>
                      {isAdmin && <TableHead className="text-right">Final Amt</TableHead>}
                      {isAdmin && <TableHead className="text-right">Prod. Cost</TableHead>}
                      {isAdmin && <TableHead className="text-right">Profit / Loss</TableHead>}
                      {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClientGroups.map((group) => (
                      <ClientGroupRow
                        key={group.groupKey}
                        group={group}
                        colSpan={totalColSpan}
                        isAdmin={isAdmin}
                        onPaymentClick={openPaymentModal}
                        handleDeleteSale={handleDeleteSale}
                        handleDeleteGroup={handleDeleteClientGroup}
                        router={router}
                      />
                    ))}
                    <TableRow className="bg-muted/60 font-semibold border-t-2">
                      <TableCell colSpan={5} className="py-3 pl-4 text-sm">
                        Page Total - {paginatedClientGroups.length} client{paginatedClientGroups.length !== 1 ? 's' : ''} - {pageRecords.length} record{pageRecords.length !== 1 ? 's' : ''}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right text-sm py-3">{formatCurrency(pageSummary.totalRevenue)}</TableCell>
                      )}
                      {isAdmin && (
                        <TableCell className="text-right text-sm py-3 text-muted-foreground">
                          {formatCurrency(pageRecords.reduce((s, r) => s + (r.productionCostPerUnit ?? 0) * r.quantitySold, 0))}
                        </TableCell>
                      )}
                      {isAdmin && (
                        <TableCell className="text-right py-3">
                          <span className={`text-sm font-semibold ${pageSummary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(pageSummary.totalProfit)}
                          </span>
                        </TableCell>
                      )}
                      {isAdmin && <TableCell />}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
            <RecordPagination {...clientGroupsPagination} itemLabel="records" className="px-4" />
          </CardContent>
        </Card>

        {/* Mobile view */}
        <div className="md:hidden space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : clientGroups.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                {salesRecords.length === 0 ? 'No sales records found' : 'No records match the current filters'}
              </CardContent>
            </Card>
          ) : (
            <>
              {paginatedClientGroups.map((group) => (
                <MobileClientCard
                  key={group.groupKey}
                  group={group}
                  isAdmin={isAdmin}
                  onPaymentClick={openPaymentModal}
                  handleDeleteSale={handleDeleteSale}
                  handleDeleteGroup={handleDeleteClientGroup}
                  router={router}
                />
              ))}
              <RecordPagination {...clientGroupsPagination} itemLabel="records" className="px-0" />
            </>
          )}
        </div>

        {/* ── Maintenance modal ── */}
        <Dialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />Sales Maintenance
              </DialogTitle>
              <DialogDescription>Assign city and salesman to a client.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 overflow-hidden">
              <div className="space-y-2">
                <Label>Client Name *</Label>
                <ClientCombobox value={maintClient} onChange={handleMaintClientChange} options={uniqueClients} />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <CreatableCombobox value={maintCity} onChange={setMaintCity} options={uniqueCities} placeholder="Select or type city..." />
              </div>
              <div className="space-y-2">
                <Label>Salesman</Label>
                <CreatableCombobox value={maintSalesman} onChange={setMaintSalesman} options={uniqueSalesmen} placeholder="Select or type salesman..." />
              </div>
              {clientMetas.filter((m) => m.city || m.salesman).length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Existing Assignments
                  </div>
                  <div className="max-h-[200px] overflow-y-auto divide-y">
                    {clientMetas.filter((m) => m.city || m.salesman).map((m) => (
                      <div key={m.id} className="px-3 py-2 flex items-center gap-2 text-sm hover:bg-muted/20">
                        <span className="font-medium truncate flex-1 min-w-0">{m.clientName}</span>
                        <div className="flex gap-1 shrink-0 flex-wrap">
                          {m.city && <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5">{m.city}</span>}
                          {m.salesman && <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.5">{m.salesman}</span>}
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                          onClick={() => handleMaintClientChange(m.clientName)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Assignment?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Remove city/salesman for <strong>{m.clientName}</strong>?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={async () => {
                                  try {
                                    const res = await fetch('/api/clients/meta', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ clientName: m.clientName, city: null, salesman: null }),
                                    });
                                    if (!res.ok) throw new Error();
                                    toast.success(`Cleared for ${m.clientName}`);
                                    await fetchClientMetas();
                                  } catch { toast.error('Failed to remove assignment'); }
                                }}
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMaintenanceOpen(false)}>Close</Button>
              <Button onClick={saveMaintenance} disabled={isSavingMaint || !maintClient} className="gap-2">
                {isSavingMaint
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
                  : <><Save className="h-4 w-4" />Save</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Payment modal ── */}
        <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                {selectedGroup?.clientName}
                {selectedGroup?.voucherNo ? ` — Invoice ${selectedGroup.voucherNo}` : ''}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">

              {/* ── Payment summary card ── */}
              <div className="rounded-lg border bg-muted/30 divide-y overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Invoice Total</span>
                  <span className="font-semibold">
                    {selectedGroup && formatCurrency(selectedGroup.groupTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Total Paid So Far</span>
                  <span className={cn(
                    'font-semibold',
                    (selectedGroup?.amountPaid ?? 0) > 0 ? 'text-green-600' : 'text-muted-foreground',
                  )}>
                    {selectedGroup && formatCurrency(selectedGroup.amountPaid ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-orange-50/70">
                  <span className="font-medium text-orange-700">Balance Due</span>
                  <span className="font-bold text-orange-700">
                    {selectedGroup && formatCurrency(
                      Math.max(0, selectedGroup.groupTotal - (selectedGroup.amountPaid ?? 0)),
                    )}
                  </span>
                </div>
              </div>

              {/* ── New payment input ── */}
              <div className="space-y-2">
                <Label>
                  Amount Received Now
                  <span className="text-muted-foreground font-normal ml-1 text-xs">
                    (max{' '}
                    {selectedGroup && formatCurrency(
                      Math.max(0, selectedGroup.groupTotal - (selectedGroup.amountPaid ?? 0)),
                    )}
                    )
                  </span>
                </Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={additionalAmount}
                  onChange={(e) => setAdditionalAmount(e.target.value)}
                  min={0.01}
                  autoFocus
                />

                {/* Live preview */}
                {selectedGroup &&
                  additionalAmount &&
                  !isNaN(parseFloat(additionalAmount)) &&
                  parseFloat(additionalAmount) > 0 &&
                  (() => {
                    const added = parseFloat(additionalAmount);
                    const prevPaid = selectedGroup.amountPaid ?? 0;
                    const newTotal = prevPaid + added;
                    const newBalance = Math.max(0, selectedGroup.groupTotal - newTotal);
                    const isFullyPaid = newBalance <= 0;
                    return (
                      <div className={cn(
                        'rounded-md border px-3 py-2.5 text-xs space-y-1.5',
                        isFullyPaid ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200',
                      )}>
                        <div className="flex justify-between">
                          <span className={isFullyPaid ? 'text-green-700' : 'text-blue-700'}>
                            New total paid
                          </span>
                          <span className={cn('font-semibold', isFullyPaid ? 'text-green-800' : 'text-blue-800')}>
                            {formatCurrency(newTotal)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={isFullyPaid ? 'text-green-700' : 'text-blue-700'}>
                            Remaining balance
                          </span>
                          <span className={cn('font-semibold', isFullyPaid ? 'text-green-800' : 'text-blue-800')}>
                            {isFullyPaid ? '✓ Fully Paid' : formatCurrency(newBalance)}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                }
              </div>

              {/* ── Note ── */}
              <div className="space-y-2">
                <Label>
                  Note{' '}
                  <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                </Label>
                <Input
                  placeholder="e.g. Cheque no. 1234, UPI ref, cash..."
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                />
              </div>

              {/* ── Irreversibility notice ── */}
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0">⚠</span>
                Payments are cumulative and permanent. Once saved, the paid amount cannot be reduced.
              </p>

            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closePaymentModal} disabled={isSavingPayment}>
                Cancel
              </Button>
              <Button
                onClick={savePaymentStatus}
                disabled={
                  isSavingPayment ||
                  !additionalAmount ||
                  isNaN(parseFloat(additionalAmount)) ||
                  parseFloat(additionalAmount) <= 0
                }
              >
                {isSavingPayment ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  `Record ${additionalAmount && !isNaN(parseFloat(additionalAmount)) && parseFloat(additionalAmount) > 0
                    ? formatCurrency(parseFloat(additionalAmount))
                    : 'Payment'}`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}

/* ── Mobile client card ──────────────────────────────────────────────────── */
function MobileClientCard({
  group, isAdmin, onPaymentClick, handleDeleteSale, handleDeleteGroup, router,
}: {
  group: ClientGroup; isAdmin: boolean;
  onPaymentClick: (g: ClientGroup) => void;
  handleDeleteSale: (id: string) => void;
  handleDeleteGroup: (group: ClientGroup) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [open, setOpen] = useState(false);

  const paymentBadge = (() => {
    const status = group.paymentStatus || 'unpaid';
    let cls = ''; let label = '';
    if (status === 'paid') {
      cls = 'bg-green-100 text-green-800 border-green-300';
      label = 'PAID';
    } else if (status === 'unpaid') {
      cls = 'bg-red-100 text-red-800 border-red-300';
      label = 'UNPAID';
    } else {
      cls = 'bg-orange-100 text-orange-800 border-orange-300';
      const balance = Math.max(0, group.groupTotal - (group.amountPaid ?? 0));
      label = `PARTIAL ${formatCurrency(balance)}`;
    }
    return (
      <Badge
        variant="outline"
        className={`${cls} text-xs cursor-pointer hover:opacity-80`}
        onClick={(e) => { e.stopPropagation(); onPaymentClick(group); }}
      >
        {label}
      </Badge>
    );
  })();

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full bg-primary/5 border-b border-primary/15 px-4 py-3 flex items-center justify-between gap-2 hover:bg-primary/10 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-5 w-5 flex items-center justify-center shrink-0 text-primary">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
          <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <User className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{group.clientName}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span>{formatSaleDate(group.saleDate)}</span>
              {group.voucherType && <span>{group.voucherType}</span>}
              {group.voucherNo && <span className="font-mono">{group.voucherNo}</span>}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0 space-y-1">
          {paymentBadge}
          <p className="font-semibold text-sm">{formatCurrency(group.groupTotal)}</p>
        </div>
      </button>

      {open && (
        <CardContent className="p-0 divide-y animate-in fade-in slide-in-from-top-1 duration-150">
          {group.records.map((record, idx) => {
            const prodCost = (record.productionCostPerUnit ?? 0) * record.quantitySold;
            const isFree = record.sellingPricePerUnit === 0;
            return (
              <div key={record.id} className="px-4 py-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{idx + 1}</span>
                    <p className="font-medium text-sm">{record.productName}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => router.push(`/sales/${record.id}/edit`)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Sales Record</AlertDialogTitle>
                            <AlertDialogDescription>Are you sure? Quantity will be restored.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteSale(record.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div><p className="text-muted-foreground">Packets</p><p className="font-medium">{record.quantitySold}</p></div>
                  <div><p className="text-muted-foreground">Price/Pkt</p><p className="font-medium">{formatCurrency(record.sellingPricePerUnit)}</p></div>
                  <div><p className="text-muted-foreground">Prod. Cost</p><p className="font-medium">{formatCurrency(prodCost)}</p></div>
                  <div><p className="text-muted-foreground">Final Amt</p><p className="font-semibold">{formatCurrency(record.totalAmount)}</p></div>
                </div>
                {isAdmin && !isFree && (
                  <div className="mt-1.5">
                    <span className={`text-xs font-semibold flex items-center gap-0.5 ${record.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {record.profit >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {formatCurrency(Math.abs(record.profit))}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          <div className="px-4 py-2 bg-muted/30 flex items-center justify-between gap-2 text-xs font-medium">
            <span className="text-muted-foreground">{group.records.length} item{group.records.length !== 1 ? 's' : ''}</span>
            <div className="flex items-center gap-2">
              <span>{formatCurrency(group.groupTotal)}</span>
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Client Record</AlertDialogTitle>
                      <AlertDialogDescription>
                        Delete all {group.records.length} item{group.records.length !== 1 ? 's' : ''} for <strong>{group.clientName}</strong>? Quantity will be restored.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteGroup(group)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
