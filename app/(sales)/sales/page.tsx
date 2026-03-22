'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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

import {
  Plus, Upload, Filter, TrendingUp, IndianRupee, Package,
  Pencil, Trash2, Loader2, User, CheckCircle2, ArrowUpRight,
  ArrowDownRight, ChevronDown, ChevronRight, X, Check, ChevronsUpDown,
  Download, Settings2, Save, BarChart3,
} from 'lucide-react';

import { StatCard } from '@/components/inventory/StatCard';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/libs/utils';
import {
  calculateSalesSummary, formatCurrency, formatSaleDate, type SalesRecord,
} from '@/data/salesData';

const SHOW_PROFIT_TO_STAFF = true;
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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
  paymentStatus?: 'paid' | 'unpaid' | 'partial';
  amountPaid?: number;
  amountDue?: number;
  paymentNote?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
        paymentStatus: 'paid',
        amountPaid: 0,
        amountDue: 0,
        paymentNote: record.paymentNote,
      });
    }
    const g = map.get(key)!;
    g.records.push(record);
    g.groupTotal += record.totalAmount ?? 0;
    g.groupProfit += record.profit ?? 0;
    g.amountPaid = (g.amountPaid ?? 0) + (record.amountPaid ?? record.totalAmount ?? 0);
    g.amountDue = (g.amountDue ?? 0) + (record.amountDue ?? 0);
    const s = record.paymentStatus ?? 'paid';
    if (s === 'unpaid') g.paymentStatus = 'unpaid';
    else if (s === 'partial' && g.paymentStatus !== 'unpaid') g.paymentStatus = 'partial';
  });
  return Array.from(map.values());
}

// ─── Multi-select filter ──────────────────────────────────────────────────────

function MultiSelectFilter({
  label, values, onChange, options, placeholder,
}: {
  label: string; values: string[]; onChange: (v: string[]) => void;
  options: string[]; placeholder: string;
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
          className={cn('justify-between font-normal', values.length > 0 && 'border-primary text-primary')}>
          <span className="truncate max-w-[160px]">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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

function CreatableCombobox({
  value, onChange, options, placeholder,
}: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  useEffect(() => { if (!value) setInputValue(''); }, [value]);
  const filtered = options.filter((o) => o.toLowerCase().includes(inputValue.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
                Press Enter to use "<strong>{inputValue}</strong>"
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
  group, colSpan, isAdmin, onPaymentClick, handleDeleteSale, router,
}: {
  group: ClientGroup; colSpan: number; isAdmin: boolean;
  onPaymentClick: (group: ClientGroup) => void;
  handleDeleteSale: (id: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [open, setOpen] = useState(false);

  const paymentBadge = (() => {
    const status = group.paymentStatus || 'paid';
    const paid = group.amountPaid ?? group.groupTotal;
    let cls = ''; let label = '';
    if (status === 'paid') { cls = 'bg-green-100 text-green-800 border-green-300'; label = 'PAID'; }
    else if (status === 'unpaid') { cls = 'bg-red-100 text-red-800 border-red-300'; label = 'UNPAID'; }
    else { cls = 'bg-orange-100 text-orange-800 border-orange-300'; label = `PARTIAL (${formatCurrency(paid)})`; }
    return (
      <Badge variant="outline" className={`${cls} text-xs cursor-pointer hover:opacity-80`}
        onClick={(e) => { e.stopPropagation(); onPaymentClick(group); }}>
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
                {SHOW_PROFIT_TO_STAFF && (
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
            <TableCell className="text-right font-semibold text-sm py-1.5">{formatCurrency(group.groupTotal)}</TableCell>
            <TableCell className="text-right text-xs text-muted-foreground py-1.5">
              {formatCurrency(group.records.reduce((s, r) => s + (r.productionCostPerUnit ?? 0) * r.quantitySold, 0))}
            </TableCell>
            {SHOW_PROFIT_TO_STAFF && (
              <TableCell className="text-right py-1.5">
                <span className={`text-xs font-semibold ${group.groupProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(group.groupProfit)}
                </span>
              </TableCell>
            )}
            <TableCell colSpan={isAdmin ? 1 : 0} />
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
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'partial'>('paid');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // ── Fetch records ─────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
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
    salesRecords.forEach((r) => years.add(new Date(r.saleDate).getFullYear()));
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
    return salesRecords.filter((r) => {
      const d = new Date(r.saleDate);
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
      if (startDate && d < new Date(startDate)) return false;
      if (endDate && d > new Date(endDate)) return false;
      return true;
    });
  }, [
    salesRecords, selectedMonths, selectedYears,
    productFilters, clientFilters, cityFilters, salesmanFilters,
    startDate, endDate, clientMetaMap,
  ]);

  const clientGroups = useMemo(() => groupByClient(filteredRecords), [filteredRecords]);
  const allRecords = useMemo(() => clientGroups.flatMap((g) => g.records), [clientGroups]);
  const summary = useMemo(() => calculateSalesSummary(allRecords), [allRecords]);

  // ── Average revenue ───────────────────────────────────────────────────────
  const { avgRevenue, avgLabel } = useMemo(() => {
    if (selectedMonths.length === 1 && selectedYears.length <= 1) {
      const days = new Set(filteredRecords.map((r) => r.saleDate.split('T')[0]));
      const count = days.size;
      return { avgRevenue: count > 0 ? summary.totalRevenue / count : 0, avgLabel: 'Avg / Day' };
    }
    const months = new Set(
      filteredRecords.map((r) => {
        const d = new Date(r.saleDate);
        return `${d.getFullYear()}-${d.getMonth()}`;
      }),
    );
    const count = months.size;
    return { avgRevenue: count > 0 ? summary.totalRevenue / count : 0, avgLabel: 'Avg / Month' };
  }, [filteredRecords, summary.totalRevenue, selectedMonths, selectedYears]);

  const hasActiveFilters =
    productFilters.length > 0 || clientFilters.length > 0 ||
    cityFilters.length > 0 || salesmanFilters.length > 0 ||
    !!startDate || !!endDate;

  const clearFilters = () => {
    setProductFilters([]); setClientFilters([]);
    setCityFilters([]); setSalesmanFilters([]);
    setStartDate(''); setEndDate(''); setFilterOpen(false);
  };

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

  // ── Payment ───────────────────────────────────────────────────────────────
  const openPaymentModal = (group: ClientGroup) => {
    setSelectedGroup(group);
    setPaymentStatus(group.paymentStatus ?? 'paid');
    setAmountPaid((group.amountPaid ?? group.groupTotal).toString());
    setPaymentNote(group.paymentNote ?? '');
    setPaymentModalOpen(true);
  };
  const closePaymentModal = () => {
    setPaymentModalOpen(false); setSelectedGroup(null);
    setPaymentStatus('paid'); setAmountPaid(''); setPaymentNote('');
  };
  const savePaymentStatus = async () => {
    if (!selectedGroup) return;
    const parsedAmount = parseFloat(amountPaid);
    if (isNaN(parsedAmount) || parsedAmount < 0) { toast.error('Please enter a valid amount'); return; }
    if (parsedAmount > selectedGroup.groupTotal) { toast.error('Amount paid cannot exceed total amount'); return; }
    try {
      setIsSavingPayment(true);
      await Promise.all(
        selectedGroup.records.map((record) => {
          const proportion = selectedGroup.groupTotal > 0
            ? record.totalAmount / selectedGroup.groupTotal
            : 1 / selectedGroup.records.length;
          const recordAmountPaid = parseFloat((parsedAmount * proportion).toFixed(2));
          const recordAmountDue = parseFloat(Math.max(0, record.totalAmount - recordAmountPaid).toFixed(2));
          return fetch(`/api/sales/records/${record.id}/payment`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentStatus, amountPaid: recordAmountPaid, amountDue: recordAmountDue, paymentNote: paymentNote.trim() || null }),
          });
        }),
      );
      toast.success('Payment status updated');
      closePaymentModal();
      fetchRecords();
    } catch { toast.error('Failed to update payment status'); }
    finally { setIsSavingPayment(false); }
  };
  useEffect(() => {
    if (!selectedGroup) return;
    if (paymentStatus === 'paid') setAmountPaid(selectedGroup.groupTotal.toString());
    else if (paymentStatus === 'unpaid') setAmountPaid('0');
  }, [paymentStatus, selectedGroup]);

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
      cityFilters.length > 0 ? `Cities: ${cityFilters.join(', ')}` : null,
      salesmanFilters.length > 0 ? `Salesmen: ${salesmanFilters.join(', ')}` : null,
      startDate ? `From: ${startDate}` : null,
      endDate ? `To: ${endDate}` : null,
    ].filter(Boolean);

    const statsHtml = `
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-label">Total Sales</div><div class="stat-value">${summary.salesCount}</div></div>
        <div class="stat-box"><div class="stat-label">Revenue</div><div class="stat-value">${formatCurrency(summary.totalRevenue)}</div></div>
        <div class="stat-box"><div class="stat-label">Qty Sold</div><div class="stat-value">${summary.totalQuantity} pkts</div></div>
        <div class="stat-box"><div class="stat-label">Profit</div><div class="stat-value ${summary.totalProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(summary.totalProfit)}</div></div>
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
          <td class="right ${r.profit >= 0 ? 'profit' : 'loss'}">${formatCurrency(r.profit)}</td>
        </tr>`).join('');
      const payStatus = group.paymentStatus || 'paid';
      const payLabel2 = payStatus === 'paid' ? 'PAID' : payStatus === 'unpaid' ? 'UNPAID' : `PARTIAL (${formatCurrency(group.amountPaid ?? 0)})`;
      return `
        <tr class="group-header"><td colspan="8">
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
          <td class="right ${group.groupProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(group.groupProfit)}</td>
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
      .stats-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px}
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
      <th class="right">Prod. Cost</th><th class="right">Profit/Loss</th>
    </tr></thead><tbody>
      ${rows}
      <tr class="grand">
        <td colspan="5">Grand Total — ${clientGroups.length} client${clientGroups.length !== 1 ? 's' : ''} · ${allRecords.length} records</td>
        <td class="right">${formatCurrency(summary.totalRevenue)}</td>
        <td class="right muted">${formatCurrency(allRecords.reduce((s, r) => s + (r.productionCostPerUnit ?? 0) * r.quantitySold, 0))}</td>
        <td class="right ${summary.totalProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(summary.totalProfit)}</td>
      </tr>
    </tbody></table></body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const totalColSpan = 5 + (isAdmin ? 2 : 0) + (SHOW_PROFIT_TO_STAFF ? 1 : 0) + (isAdmin ? 1 : 0);

  const FilterContent = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Client</Label>
        <MultiSelectFilter label="Client" values={clientFilters} onChange={setClientFilters} options={uniqueClients} placeholder="All Clients" />
      </div>
      <div className="space-y-2">
        <Label>Product</Label>
        <MultiSelectFilter label="Product" values={productFilters} onChange={setProductFilters} options={uniqueProducts} placeholder="All Products" />
      </div>
      <div className="space-y-2">
        <Label>City</Label>
        <MultiSelectFilter label="City" values={cityFilters} onChange={setCityFilters} options={uniqueCities} placeholder="All Cities" />
      </div>
      <div className="space-y-2">
        <Label>Salesman</Label>
        <MultiSelectFilter label="Salesman" values={salesmanFilters} onChange={setSalesmanFilters} options={uniqueSalesmen} placeholder="All Salesmen" />
      </div>
      <div className="space-y-2">
        <Label>Start Date</Label>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>End Date</Label>
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
      {hasActiveFilters && (
        <Button variant="outline" onClick={clearFilters} className="w-full">Clear All Filters</Button>
      )}
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Sales Summary</h1>
            <p className="text-sm text-muted-foreground">View and analyze sales records</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={openMaintenance} className="gap-2">
              <Settings2 className="h-4 w-4" />Sales Maintenance
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF} disabled={loading || allRecords.length === 0} className="gap-2">
              <Download className="h-4 w-4" />Download PDF
            </Button>
            <Button variant="outline" onClick={() => router.push('/sales/upload')}>
              <Upload className="h-4 w-4 mr-2" />Upload
            </Button>
            <Button onClick={() => router.push('/sales/new')}>
              <Plus className="h-4 w-4 mr-2" />New Sale
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
                      const d = new Date(r.saleDate);
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
                  <span className="text-xs text-muted-foreground shrink-0">{filteredRecords.length} records</span>
                </div>
              )}

            </div>
          </CardContent>
        </Card>

        {/* Stats — 5 boxes */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-8 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard title="Total Sales" value={summary.salesCount.toString()} icon={Package} />
            <StatCard title="Revenue" value={formatCurrency(summary.totalRevenue)} icon={IndianRupee} />
            <StatCard title="Qty Sold" value={`${summary.totalQuantity} packets`} icon={TrendingUp} />
            {SHOW_PROFIT_TO_STAFF && (
              <StatCard title="Profit" value={formatCurrency(summary.totalProfit)} icon={TrendingUp} />
            )}
            <StatCard title={avgLabel} value={formatCurrency(avgRevenue)} icon={BarChart3} />
          </div>
        )}

        {/* Desktop filter bar */}
        <Card className="hidden md:block">
          <CardContent className="py-4">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Client</Label>
                <MultiSelectFilter label="Client" values={clientFilters} onChange={setClientFilters} options={uniqueClients} placeholder="All Clients" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Product</Label>
                <MultiSelectFilter label="Product" values={productFilters} onChange={setProductFilters} options={uniqueProducts} placeholder="All Products" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">City</Label>
                <MultiSelectFilter label="City" values={cityFilters} onChange={setCityFilters} options={uniqueCities} placeholder="All Cities" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Salesman</Label>
                <MultiSelectFilter label="Salesman" values={salesmanFilters} onChange={setSalesmanFilters} options={uniqueSalesmen} placeholder="All Salesmen" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36" />
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="self-end">
                  <X className="h-4 w-4 mr-1" />Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mobile filter */}
        <div className="md:hidden">
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="w-full gap-2">
                <Filter className="h-4 w-4" />Filters
                {hasActiveFilters && <Badge variant="secondary">Active</Badge>}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
              <SheetHeader><SheetTitle>Filter Sales</SheetTitle></SheetHeader>
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
                      {SHOW_PROFIT_TO_STAFF && <TableHead className="text-right">Profit / Loss</TableHead>}
                      {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientGroups.map((group) => (
                      <ClientGroupRow
                        key={group.groupKey}
                        group={group}
                        colSpan={totalColSpan}
                        isAdmin={isAdmin}
                        onPaymentClick={openPaymentModal}
                        handleDeleteSale={handleDeleteSale}
                        router={router}
                      />
                    ))}
                    <TableRow className="bg-muted/60 font-semibold border-t-2">
                      <TableCell colSpan={5} className="py-3 pl-4 text-sm">
                        Grand Total — {clientGroups.length} client{clientGroups.length !== 1 ? 's' : ''} · {allRecords.length} record{allRecords.length !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell className="text-right text-sm py-3">{formatCurrency(summary.totalRevenue)}</TableCell>
                      <TableCell className="text-right text-sm py-3 text-muted-foreground">
                        {formatCurrency(allRecords.reduce((s, r) => s + (r.productionCostPerUnit ?? 0) * r.quantitySold, 0))}
                      </TableCell>
                      {SHOW_PROFIT_TO_STAFF && (
                        <TableCell className="text-right py-3">
                          <span className={`text-sm font-semibold ${summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(summary.totalProfit)}
                          </span>
                        </TableCell>
                      )}
                      <TableCell colSpan={isAdmin ? 1 : 0} />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
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
          ) : clientGroups.map((group) => (
            <MobileClientCard
              key={group.groupKey}
              group={group}
              isAdmin={isAdmin}
              onPaymentClick={openPaymentModal}
              handleDeleteSale={handleDeleteSale}
              router={router}
            />
          ))}
        </div>

        {/* Maintenance modal */}
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

        {/* Payment modal */}
        <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Payment Status</DialogTitle>
              <DialogDescription>
                Update payment for {selectedGroup?.clientName}
                {selectedGroup?.voucherNo ? ` — ${selectedGroup.voucherNo}` : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground mb-1">
                  Invoice Total ({selectedGroup?.records.length} items)
                </p>
                <p className="text-2xl font-bold">
                  {selectedGroup && formatCurrency(selectedGroup.groupTotal)}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Payment Status</Label>
                <Select
                  value={paymentStatus}
                  onValueChange={(v: 'paid' | 'unpaid' | 'partial') => setPaymentStatus(v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid (Full)</SelectItem>
                    <SelectItem value="partial">Partial Payment</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount Paid</Label>
                <Input
                  type="number" placeholder="0.00" value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  disabled={paymentStatus === 'paid' || paymentStatus === 'unpaid'}
                />
                {selectedGroup && parseFloat(amountPaid) > 0 && parseFloat(amountPaid) < selectedGroup.groupTotal && (
                  <p className="text-sm text-muted-foreground">
                    Balance due: {formatCurrency(selectedGroup.groupTotal - parseFloat(amountPaid))}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Note (Optional)</Label>
                <Input
                  placeholder="Payment reference, remarks..."
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closePaymentModal} disabled={isSavingPayment}>Cancel</Button>
              <Button onClick={savePaymentStatus} disabled={isSavingPayment}>
                {isSavingPayment
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                  : 'Save Payment Status'}
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
  group, isAdmin, onPaymentClick, handleDeleteSale, router,
}: {
  group: ClientGroup; isAdmin: boolean;
  onPaymentClick: (g: ClientGroup) => void;
  handleDeleteSale: (id: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [open, setOpen] = useState(false);

  const paymentBadge = (() => {
    const status = group.paymentStatus || 'paid';
    const paid = group.amountPaid ?? group.groupTotal;
    let cls = ''; let label = '';
    if (status === 'paid') { cls = 'bg-green-100 text-green-800 border-green-300'; label = 'PAID'; }
    else if (status === 'unpaid') { cls = 'bg-red-100 text-red-800 border-red-300'; label = 'UNPAID'; }
    else { cls = 'bg-orange-100 text-orange-800 border-orange-300'; label = `PARTIAL (${formatCurrency(paid)})`; }
    return (
      <Badge variant="outline" className={`${cls} text-xs cursor-pointer hover:opacity-80`}
        onClick={(e) => { e.stopPropagation(); onPaymentClick(group); }}>
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
                {SHOW_PROFIT_TO_STAFF && !isFree && (
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
          <div className="px-4 py-2 bg-muted/30 flex justify-between text-xs font-medium">
            <span className="text-muted-foreground">{group.records.length} item{group.records.length !== 1 ? 's' : ''}</span>
            <span>{formatCurrency(group.groupTotal)}</span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}