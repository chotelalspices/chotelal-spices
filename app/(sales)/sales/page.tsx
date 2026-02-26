'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import {
  Plus,
  Upload,
  Filter,
  TrendingUp,
  IndianRupee,
  Package,
  Pencil,
  Trash2,
  Loader2,
  User,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

import { StatCard } from '@/components/inventory/StatCard';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

import {
  calculateSalesSummary,
  formatCurrency,
  formatSaleDate,
  type SalesRecord,
} from '@/data/salesData';

/* ------------------------------------------------------------------ */
const SHOW_PROFIT_TO_STAFF = true;

/* ------------------------------------------------------------------ */
interface ClientGroup {
  groupKey: string;
  clientName: string;
  voucherNo: string;
  voucherType: string;
  saleDate: string;
  records: SalesRecord[];
  groupTotal: number;
  groupProfit: number;
}

interface PaymentStatus {
  status: 'paid' | 'unpaid' | 'partial';
  amountPaid: number;
  amountDue: number;
  paymentDate?: string;
  paymentNote?: string;
}

function groupByClient(records: SalesRecord[]): ClientGroup[] {
  const map = new Map<string, ClientGroup>();
  records.forEach((record) => {
    const key =
      record.voucherNo?.trim() ||
      `${(record.clientName || 'Unknown').trim()}__${record.saleDate}`;
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
      });
    }
    const g = map.get(key)!;
    g.records.push(record);
    g.groupTotal  += record.totalAmount ?? 0;
    g.groupProfit += record.profit      ?? 0;
  });
  return Array.from(map.values());
}

/* ================================================================
   COMPONENT
================================================================ */
export default function SalesSummary() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [loading, setLoading]           = useState(true);
  const [productFilter, setProductFilter] = useState('all');
  const [clientFilter,  setClientFilter]  = useState('all');
  const [startDate, setStartDate]         = useState('');
  const [endDate,   setEndDate]           = useState('');
  const [filterOpen, setFilterOpen]       = useState(false);

  // ── Payment modal state ──
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SalesRecord | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'partial'>('paid');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sales/records');
      if (!res.ok) throw new Error();
      setSalesRecords(await res.json());
    } catch {
      toast.error('Failed to load sales records.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchRecords(); }, []);

  const uniqueProducts = useMemo(
    () => [...new Set(salesRecords.map((r) => r.productName))].sort(),
    [salesRecords]
  );
  const uniqueClients = useMemo(
    () => [...new Set(salesRecords.map((r) => r.clientName?.trim()).filter((c): c is string => !!c))].sort(),
    [salesRecords]
  );

  const filteredRecords = useMemo(() =>
    salesRecords.filter((r) => {
      if (productFilter !== 'all' && r.productName !== productFilter) return false;
      if (clientFilter  !== 'all' && r.clientName?.trim() !== clientFilter) return false;
      if (startDate && new Date(r.saleDate) < new Date(startDate)) return false;
      if (endDate   && new Date(r.saleDate) > new Date(endDate))   return false;
      return true;
    }),
  [salesRecords, productFilter, clientFilter, startDate, endDate]);

  const clientGroups = useMemo(() => groupByClient(filteredRecords), [filteredRecords]);
  const summary      = useMemo(() => calculateSalesSummary(filteredRecords), [filteredRecords]);
  const hasActiveFilters = productFilter !== 'all' || clientFilter !== 'all' || startDate || endDate;

  const clearFilters = () => {
    setProductFilter('all'); setClientFilter('all');
    setStartDate(''); setEndDate(''); setFilterOpen(false);
  };

  const handleDeleteSale = async (saleId: string) => {
    try {
      const res = await fetch(`/api/sales/records/${saleId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete');
      toast.success('Sales record deleted');
      fetchRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  // ── Payment modal handlers ──
  const openPaymentModal = (record: SalesRecord) => {
    setSelectedRecord(record);
    
    // Initialize with existing payment data if available
    const existingStatus = (record as any).paymentStatus || 'paid';
    const existingPaid = (record as any).amountPaid || record.totalAmount;
    
    setPaymentStatus(existingStatus);
    setAmountPaid(existingPaid.toString());
    setPaymentNote((record as any).paymentNote || '');
    setPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setPaymentModalOpen(false);
    setSelectedRecord(null);
    setPaymentStatus('paid');
    setAmountPaid('');
    setPaymentNote('');
  };

  const savePaymentStatus = async () => {
    if (!selectedRecord) return;

    const parsedAmount = parseFloat(amountPaid);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (parsedAmount > selectedRecord.totalAmount) {
      toast.error('Amount paid cannot exceed total amount');
      return;
    }

    try {
      setIsSavingPayment(true);

      const payload = {
        paymentStatus,
        amountPaid: parsedAmount,
        amountDue: selectedRecord.totalAmount - parsedAmount,
        paymentNote: paymentNote.trim() || null,
      };

      const res = await fetch(`/api/sales/records/${selectedRecord.id}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update payment status');
      }

      toast.success('Payment status updated successfully');
      closePaymentModal();
      fetchRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update payment status');
    } finally {
      setIsSavingPayment(false);
    }
  };

  // Automatically set amount based on status
  useEffect(() => {
    if (!selectedRecord) return;
    
    if (paymentStatus === 'paid') {
      setAmountPaid(selectedRecord.totalAmount.toString());
    } else if (paymentStatus === 'unpaid') {
      setAmountPaid('0');
    }
    // For 'partial', let user enter amount manually
  }, [paymentStatus, selectedRecord]);

  const getPaymentBadge = (record: SalesRecord) => {
    const isFree = record.sellingPricePerUnit === 0;
    if (isFree) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs cursor-default">FREE</Badge>;
    }

    const status = (record as any).paymentStatus || 'paid';
    const amountPaid = (record as any).amountPaid || record.totalAmount;
    const amountDue = record.totalAmount - amountPaid;

    let badgeClass = '';
    let label = '';

    if (status === 'paid') {
      badgeClass = 'bg-green-100 text-green-800 border-green-300';
      label = 'PAID';
    } else if (status === 'unpaid') {
      badgeClass = 'bg-red-100 text-red-800 border-red-300';
      label = 'UNPAID';
    } else {
      badgeClass = 'bg-orange-100 text-orange-800 border-orange-300';
      label = `PARTIAL (${formatCurrency(amountPaid)})`;
    }

    return (
      <Badge
        variant="outline"
        className={`${badgeClass} text-xs cursor-pointer hover:opacity-80`}
        onClick={() => openPaymentModal(record)}
      >
        {label}
      </Badge>
    );
  };

  const FilterContent = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Client</Label>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger><SelectValue placeholder="All clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {uniqueClients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Product</Label>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger><SelectValue placeholder="All products" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {uniqueProducts.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Start Date</Label>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>End Date</Label>
        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
      {hasActiveFilters && <Button variant="outline" onClick={clearFilters} className="w-full">Clear Filters</Button>}
    </div>
  );

  /* ================================================================
     RENDER
  ================================================================ */
  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Sales Summary</h1>
            <p className="text-sm text-muted-foreground">View and analyze sales records</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/sales/upload')}>
              <Upload className="h-4 w-4 mr-2" />Upload
            </Button>
            <Button onClick={() => router.push('/sales/new')}>
              <Plus className="h-4 w-4 mr-2" />New Sale
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-8 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Sales"   value={summary.salesCount.toString()}       icon={Package} />
            <StatCard title="Revenue"       value={formatCurrency(summary.totalRevenue)} icon={IndianRupee} />
            <StatCard title="Qty Sold"      value={`${summary.totalQuantity} packets`}   icon={TrendingUp} />
            {SHOW_PROFIT_TO_STAFF && (
              <StatCard title="Profit" value={formatCurrency(summary.totalProfit)} icon={TrendingUp} />
            )}
          </div>
        )}

        {/* Desktop filter bar */}
        <Card className="hidden md:block">
          <CardContent className="py-4">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Client</Label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {uniqueClients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Product</Label>
                <Select value={productFilter} onValueChange={setProductFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {uniqueProducts.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>}
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
            <SheetContent side="bottom">
              <SheetHeader><SheetTitle>Filter Sales</SheetTitle></SheetHeader>
              <FilterContent />
            </SheetContent>
          </Sheet>
        </div>

        {/* DESKTOP TABLE */}
        <Card className="hidden md:block">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sales Records</CardTitle>
                <CardDescription>
                  {clientGroups.length} client{clientGroups.length !== 1 ? 's' : ''} · {filteredRecords.length} line item{filteredRecords.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
            </div>
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
                      <TableHead className="text-right">Final Amt</TableHead>
                      <TableHead className="text-right">Prod. Cost</TableHead>
                      {SHOW_PROFIT_TO_STAFF && (
                        <TableHead className="text-right">Profit / Loss</TableHead>
                      )}
                      <TableHead className="text-center">Payment</TableHead>
                      {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {clientGroups.map((group) => (
                      <>
                        {/* CLIENT HEADER ROW */}
                        <TableRow
                          key={`grp-${group.groupKey}`}
                          className="bg-primary/5 border-t-2 border-primary/20 hover:bg-primary/5"
                        >
                          <TableCell
                            colSpan={7 + (SHOW_PROFIT_TO_STAFF ? 1 : 0) + (isAdmin ? 1 : 0)}
                            className="py-2.5 px-4"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                                  <User className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <div>
                                  <p className="font-semibold text-sm leading-tight">{group.clientName}</p>
                                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                    <span>{formatSaleDate(group.saleDate)}</span>
                                    {group.voucherType && (
                                      <>
                                        <span className="text-muted-foreground/40">|</span>
                                        <span>{group.voucherType}</span>
                                      </>
                                    )}
                                    {group.voucherNo && (
                                      <>
                                        <span className="text-muted-foreground/40">|</span>
                                        <span className="font-mono">{group.voucherNo}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {group.records.length} valid
                                </Badge>
                                <span className="font-semibold text-sm">{formatCurrency(group.groupTotal)}</span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* PRODUCT ROWS */}
                        {group.records.map((record, idx) => {
                          const productionCostTotal = (record.productionCostPerUnit ?? 0) * record.quantitySold;
                          const isFree = record.sellingPricePerUnit === 0;

                          return (
                            <TableRow key={record.id} className="hover:bg-muted/20 bg-white">
                              <TableCell className="text-muted-foreground text-xs pl-8">{idx + 1}</TableCell>
                              <TableCell className="font-medium text-sm">{record.productName}</TableCell>
                              <TableCell className="text-right text-sm">{record.quantitySold}</TableCell>
                              <TableCell className="text-right text-sm">
                                {isFree ? (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">FREE</Badge>
                                ) : (
                                  formatCurrency(record.sellingPricePerUnit)
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {record.discount > 0 ? (
                                  <span className="text-green-600">{record.discount}</span>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium text-sm">
                                {isFree ? (
                                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">FREE</Badge>
                                ) : (
                                  formatCurrency(record.totalAmount)
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">
                                {formatCurrency(productionCostTotal)}
                              </TableCell>
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
                              <TableCell className="text-center">
                                {getPaymentBadge(record)}
                              </TableCell>
                              {isAdmin && (
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => router.push(`/sales/${record.id}/edit`)}
                                    >
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
                                          <AlertDialogDescription>
                                            Are you sure? This cannot be undone. Product quantity will be restored.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteSale(record.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
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

                        {/* SUBTOTAL ROW */}
                        <TableRow key={`sub-${group.groupKey}`} className="bg-muted/30 border-b-2 border-muted/60">
                          <TableCell colSpan={5} className="pl-8 py-1.5 text-xs text-muted-foreground">
                            {group.records.length} item{group.records.length !== 1 ? 's' : ''} for {group.clientName}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm py-1.5">
                            {formatCurrency(group.groupTotal)}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground py-1.5">
                            {formatCurrency(
                              group.records.reduce((s, r) => s + (r.productionCostPerUnit ?? 0) * r.quantitySold, 0)
                            )}
                          </TableCell>
                          {SHOW_PROFIT_TO_STAFF && (
                            <TableCell className="text-right py-1.5">
                              <span className={`text-xs font-semibold ${group.groupProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(group.groupProfit)}
                              </span>
                            </TableCell>
                          )}
                          <TableCell colSpan={isAdmin ? 2 : 1} />
                        </TableRow>
                      </>
                    ))}

                    {/* GRAND TOTAL */}
                    <TableRow className="bg-muted/60 font-semibold border-t-2">
                      <TableCell colSpan={5} className="py-3 pl-4 text-sm">
                        Grand Total — {clientGroups.length} client{clientGroups.length !== 1 ? 's' : ''} · {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell className="text-right text-sm py-3">{formatCurrency(summary.totalRevenue)}</TableCell>
                      <TableCell className="text-right text-sm py-3 text-muted-foreground">
                        {formatCurrency(filteredRecords.reduce((s, r) => s + (r.productionCostPerUnit ?? 0) * r.quantitySold, 0))}
                      </TableCell>
                      {SHOW_PROFIT_TO_STAFF && (
                        <TableCell className="text-right py-3">
                          <span className={`text-sm font-semibold ${summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(summary.totalProfit)}
                          </span>
                        </TableCell>
                      )}
                      <TableCell colSpan={isAdmin ? 2 : 1} />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* MOBILE VIEW - Similar structure with payment badges */}
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
            clientGroups.map((group) => (
              <Card key={group.groupKey} className="overflow-hidden">
                <div className="bg-primary/5 border-b border-primary/15 px-4 py-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
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
                  <div className="text-right flex-shrink-0">
                    <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50 gap-1 mb-1">
                      <CheckCircle2 className="h-3 w-3" />{group.records.length} valid
                    </Badge>
                    <p className="font-semibold text-sm">{formatCurrency(group.groupTotal)}</p>
                  </div>
                </div>

                <CardContent className="p-0 divide-y">
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
                          <div className="flex items-center gap-1">
                            {getPaymentBadge(record)}
                            {isAdmin && (
                              <>
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
                                      <AlertDialogDescription>
                                        Are you sure? Quantity will be restored to inventory.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteSale(record.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Packets</p>
                            <p className="font-medium">{record.quantitySold}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Price/Pkt</p>
                            <p className="font-medium">{formatCurrency(record.sellingPricePerUnit)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Prod. Cost</p>
                            <p className="font-medium">{formatCurrency(prodCost)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Final Amt</p>
                            <p className="font-semibold">{formatCurrency(record.totalAmount)}</p>
                          </div>
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
                    <span className="text-muted-foreground">
                      {group.records.length} item{group.records.length !== 1 ? 's' : ''} for {group.clientName}
                    </span>
                    <span>{formatCurrency(group.groupTotal)}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* ── PAYMENT STATUS MODAL ── */}
        <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Payment Status</DialogTitle>
              <DialogDescription>
                Update payment details for {selectedRecord?.productName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Total Amount */}
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                <p className="text-2xl font-bold">{selectedRecord && formatCurrency(selectedRecord.totalAmount)}</p>
              </div>

              {/* Payment Status */}
              <div className="space-y-2">
                <Label>Payment Status</Label>
                <Select value={paymentStatus} onValueChange={(v: 'paid' | 'unpaid' | 'partial') => setPaymentStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid (Full)</SelectItem>
                    <SelectItem value="partial">Partial Payment</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount Paid */}
              <div className="space-y-2">
                <Label>Amount Paid</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  disabled={paymentStatus === 'paid' || paymentStatus === 'unpaid'}
                />
                {selectedRecord && parseFloat(amountPaid) > 0 && parseFloat(amountPaid) < selectedRecord.totalAmount && (
                  <p className="text-sm text-muted-foreground">
                    Balance due: {formatCurrency(selectedRecord.totalAmount - parseFloat(amountPaid))}
                  </p>
                )}
              </div>

              {/* Payment Note */}
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
              <Button variant="outline" onClick={closePaymentModal} disabled={isSavingPayment}>
                Cancel
              </Button>
              <Button onClick={savePaymentStatus} disabled={isSavingPayment}>
                {isSavingPayment ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Payment Status'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}