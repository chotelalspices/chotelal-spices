'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, History, Loader2, Search,
  ChevronDown, ChevronRight, Clock, Edit3,
  CreditCard, RefreshCw, User, CheckCircle2,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/libs/utils';
import { formatCurrency, formatSaleDate, type SalesRecord } from '@/data/salesData';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  salesRecordId: string;
  changedAt: string;
  action: 'edit' | 'delete' | 'payment';
  changes: {
    productName?: string;
    clientName?: string;
    saleDate?: string;
    voucherNo?: string | null;
    changes: Array<{ field: string; oldValue: any; newValue: any }>;
  };
  changedBy?: { fullName: string } | null;
}

interface ClientGroup {
  groupKey: string;
  clientName: string;
  voucherNo: string;
  voucherType: string;
  saleDate: string;
  records: SalesRecord[];
  groupTotal: number;
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  amountPaid: number;
  amountDue: number;
  paymentNote: string | null;
}

// ─── Group records by voucher / client+date ───────────────────────────────────

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
        paymentStatus: 'paid',
        amountPaid: 0,
        amountDue: 0,
        paymentNote: record.paymentNote ?? null,
      });
    }

    const g = map.get(key)!;
    g.records.push(record);
    g.groupTotal += record.totalAmount ?? 0;
    g.amountPaid += record.amountPaid ?? record.totalAmount ?? 0;
    g.amountDue += record.amountDue ?? 0;

    const s = record.paymentStatus ?? 'paid';
    if (s === 'unpaid') g.paymentStatus = 'unpaid';
    else if (s === 'partial' && g.paymentStatus !== 'unpaid') g.paymentStatus = 'partial';
  });

  return Array.from(map.values());
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const actionIcon = (action: string) => {
  switch (action) {
    case 'edit':    return <Edit3 className="h-3.5 w-3.5" />;
    case 'delete':  return <span className="text-xs font-bold">✕</span>;
    case 'payment': return <CreditCard className="h-3.5 w-3.5" />;
    default:        return <Clock className="h-3.5 w-3.5" />;
  }
};

const actionColor = (action: string) => {
  switch (action) {
    case 'edit':    return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'delete':  return 'bg-red-100 text-red-800 border-red-200';
    case 'payment': return 'bg-green-100 text-green-800 border-green-200';
    default:        return 'bg-muted text-muted-foreground';
  }
};

const fieldLabel = (field: string) => {
  const map: Record<string, string> = {
    quantitySold:  'Quantity',
    sellingPrice:  'Price/Unit',
    discount:      'Discount %',
    remarks:       'Remarks',
    paymentStatus: 'Payment Status',
    amountPaid:    'Amount Paid',
    record:        'Record',
  };
  return map[field] ?? field;
};

const formatFieldValue = (field: string, value: any): string => {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') {
    if (
      field.toLowerCase().includes('price') ||
      field.toLowerCase().includes('amount') ||
      field.toLowerCase().includes('paid')
    ) return formatCurrency(value);
    return String(value);
  }
  return String(value);
};

// ─── Collapsible client group row ─────────────────────────────────────────────

function ClientGroupRow({
  group,
  onPaymentClick,
}: {
  group: ClientGroup;
  onPaymentClick: (group: ClientGroup) => void;
}) {
  const [open, setOpen] = useState(false);

  const paymentBadge = (() => {
    const s = group.paymentStatus;
    const base = 'text-xs cursor-pointer hover:opacity-80';
    if (s === 'paid') return (
      <Badge variant="outline" className={`bg-green-100 text-green-800 border-green-300 ${base}`}
        onClick={(e) => { e.stopPropagation(); onPaymentClick(group); }}>
        PAID
      </Badge>
    );
    if (s === 'unpaid') return (
      <Badge variant="outline" className={`bg-red-100 text-red-800 border-red-300 ${base}`}
        onClick={(e) => { e.stopPropagation(); onPaymentClick(group); }}>
        UNPAID
      </Badge>
    );
    return (
      <Badge variant="outline" className={`bg-orange-100 text-orange-800 border-orange-300 ${base}`}
        onClick={(e) => { e.stopPropagation(); onPaymentClick(group); }}>
        PARTIAL ({formatCurrency(group.amountPaid)})
      </Badge>
    );
  })();

  return (
    <>
      {/* Group header */}
      <TableRow
        className="bg-primary/5 border-t-2 border-primary/20 hover:bg-primary/10 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <TableCell colSpan={6} className="py-2.5 px-4">
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

      {/* Expanded product rows — read-only */}
      {open && group.records.map((record, idx) => (
        <TableRow key={record.id} className="hover:bg-muted/20 bg-white animate-in fade-in duration-150">
          <TableCell className="text-muted-foreground text-xs pl-14">{idx + 1}</TableCell>
          <TableCell className="font-medium text-sm">{record.productName}</TableCell>
          <TableCell className="text-right text-sm">{record.quantitySold}</TableCell>
          <TableCell className="text-right text-sm">{formatCurrency(record.sellingPricePerUnit)}</TableCell>
          <TableCell className="text-right text-sm">
            {record.discount > 0
              ? <span className="text-green-600">{record.discount}%</span>
              : <span className="text-muted-foreground">—</span>}
          </TableCell>
          <TableCell className="text-right font-medium text-sm">{formatCurrency(record.totalAmount)}</TableCell>
        </TableRow>
      ))}

      {/* Subtotal */}
      {open && (
        <TableRow className="bg-muted/30 border-b-2 border-muted/60">
          <TableCell colSpan={5} className="pl-14 py-1.5 text-xs text-muted-foreground">
            {group.records.length} item{group.records.length !== 1 ? 's' : ''} · {group.clientName}
          </TableCell>
          <TableCell className="text-right font-semibold text-sm py-1.5">
            {formatCurrency(group.groupTotal)}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/* ================================================================
   MAIN PAGE
================================================================ */
export default function SalesHistoryPage() {
  const router = useRouter();
  const { isAdmin, isLoading: authLoading } = useAuth();

  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'records' | 'logs'>('records');

  // Payment modal (group-level)
  const [selectedGroup, setSelectedGroup] = useState<ClientGroup | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'partial'>('paid');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error('Admin access required');
      router.push('/sales');
    }
  }, [authLoading, isAdmin, router]);

  // Fetch records
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sales/records');
      if (!res.ok) throw new Error();
      setRecords(await res.json());
    } catch {
      toast.error('Failed to load sales records');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const res = await fetch('/api/sales/audit');
      if (!res.ok) throw new Error();
      setAuditLogs(await res.json());
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); fetchLogs(); }, [fetchRecords, fetchLogs]);

  // Group records
  const clientGroups = useMemo(() => groupByClient(records), [records]);

  // Filter groups
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return clientGroups;
    const q = search.toLowerCase();
    return clientGroups.filter((g) =>
      g.clientName.toLowerCase().includes(q) ||
      g.voucherNo.toLowerCase().includes(q) ||
      g.records.some((r) => r.productName.toLowerCase().includes(q))
    );
  }, [clientGroups, search]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (!search.trim()) return auditLogs;
    const q = search.toLowerCase();
    return auditLogs.filter((l) =>
      (l.changes.productName ?? '').toLowerCase().includes(q) ||
      (l.changes.clientName ?? '').toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q)
    );
  }, [auditLogs, search]);

  // Open payment modal
  const openPaymentModal = (group: ClientGroup) => {
    setSelectedGroup(group);
    setPaymentStatus(group.paymentStatus);
    setAmountPaid((group.amountPaid ?? group.groupTotal).toString());
    setPaymentNote(group.paymentNote ?? '');
  };

  // Auto-fill amount when status changes
  useEffect(() => {
    if (!selectedGroup) return;
    if (paymentStatus === 'paid') setAmountPaid(selectedGroup.groupTotal.toString());
    else if (paymentStatus === 'unpaid') setAmountPaid('0');
  }, [paymentStatus, selectedGroup]);

  // Save payment — writes ONE group-level audit entry, then updates each record
  const savePayment = async () => {
    if (!selectedGroup) return;
    const parsed = parseFloat(amountPaid);
    if (isNaN(parsed) || parsed < 0) { toast.error('Please enter a valid amount'); return; }
    if (parsed > selectedGroup.groupTotal) { toast.error('Amount paid cannot exceed total amount'); return; }

    setSavingPayment(true);
    try {
      // ── Step 1: Write ONE group-level audit log entry ─────────────────────
      await fetch('/api/sales/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesRecordId: selectedGroup.records[0].id,
          action: 'payment',
          changes: {
            // Show as group: "ClientName (N items)" so it's clear in the log
            productName: `${selectedGroup.records.length} item${selectedGroup.records.length !== 1 ? 's' : ''}`,
            clientName: selectedGroup.clientName,
            saleDate: selectedGroup.saleDate,
            voucherNo: selectedGroup.voucherNo || null,
            changes: [
              {
                field: 'paymentStatus',
                oldValue: selectedGroup.paymentStatus,
                newValue: paymentStatus,
              },
              {
                field: 'amountPaid',
                // Show group totals, not per-record amounts
                oldValue: selectedGroup.amountPaid,
                newValue: parsed,
              },
            ],
          },
        }),
      });

      // ── Step 2: Update each record proportionally, skip per-record audit ──
      await Promise.all(
        selectedGroup.records.map((record) => {
          const proportion = selectedGroup.groupTotal > 0
            ? record.totalAmount / selectedGroup.groupTotal
            : 1 / selectedGroup.records.length;
          const recordAmountPaid = parseFloat((parsed * proportion).toFixed(2));
          const recordAmountDue = parseFloat(Math.max(0, record.totalAmount - recordAmountPaid).toFixed(2));

          return fetch(`/api/sales/records/${record.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentStatus,
              amountPaid: recordAmountPaid,
              amountDue: recordAmountDue,
              paymentNote: paymentNote.trim() || null,
              skipAuditLog: true, // prevent per-record audit entries
            }),
          });
        }),
      );

      toast.success('Payment status updated');
      setSelectedGroup(null);
      await fetchRecords();
      await fetchLogs();
    } catch {
      toast.error('Failed to update payment status');
    } finally {
      setSavingPayment(false);
    }
  };

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/sales"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <History className="h-6 w-6 text-primary" />
                Sales History
              </h1>
              <p className="text-sm text-muted-foreground">
                Update payment status and view full change log
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { fetchRecords(); fetchLogs(); }} className="gap-2">
            <RefreshCw className="h-4 w-4" />Refresh
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search client, product, voucher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="records" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Payment Status
              {clientGroups.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{clientGroups.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <History className="h-4 w-4" />
              Change Log
              {auditLogs.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{auditLogs.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Payment Status Tab ── */}
          <TabsContent value="records" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Status by Client</CardTitle>
                <CardDescription>
                  Click the payment badge on any client row to update payment. Changes reflect on the Sales Summary page.
                  {filteredGroups.length !== clientGroups.length &&
                    ` · Showing ${filteredGroups.length} of ${clientGroups.length} groups`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    {clientGroups.length === 0 ? 'No sales records found' : 'No groups match your search'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Price/Unit</TableHead>
                          <TableHead className="text-right">Disc%</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredGroups.map((group) => (
                          <ClientGroupRow
                            key={group.groupKey}
                            group={group}
                            onPaymentClick={openPaymentModal}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Change Log Tab ── */}
          <TabsContent value="logs" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Change Log</CardTitle>
                <CardDescription>
                  Full audit trail of all edits, deletes, and payment changes.
                  {filteredLogs.length !== auditLogs.length &&
                    ` · Showing ${filteredLogs.length} of ${auditLogs.length}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {logsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    {auditLogs.length === 0
                      ? 'No changes recorded yet. Payment updates, edits and deletes will appear here.'
                      : 'No logs match your search'}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredLogs.map((log) => (
                      <div key={log.id} className="px-4 py-3 hover:bg-muted/20">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">

                            {/* Action badge */}
                            <Badge
                              variant="outline"
                              className={cn('text-xs gap-1 shrink-0 capitalize mt-0.5', actionColor(log.action))}
                            >
                              {actionIcon(log.action)}
                              {log.action}
                            </Badge>

                            {/* Details */}
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {log.changes.clientName
                                  ? <><span>{log.changes.clientName}</span><span className="text-muted-foreground font-normal"> · {log.changes.productName}</span></>
                                  : log.changes.productName ?? 'Unknown'}
                                {log.changes.saleDate && (
                                  <span className="text-muted-foreground font-normal"> · {formatDate(log.changes.saleDate)}</span>
                                )}
                                {log.changes.voucherNo && (
                                  <span className="text-muted-foreground font-normal font-mono text-xs"> · {log.changes.voucherNo}</span>
                                )}
                              </p>

                              {/* Field changes */}
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {log.changes.changes?.map((c, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 text-xs bg-muted/60 rounded px-2 py-0.5"
                                  >
                                    <span className="font-medium text-muted-foreground">{fieldLabel(c.field)}:</span>
                                    <span className="line-through text-muted-foreground/60">
                                      {formatFieldValue(c.field, c.oldValue)}
                                    </span>
                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-medium text-foreground">
                                      {formatFieldValue(c.field, c.newValue)}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Timestamp + user */}
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">{formatDateTime(log.changedAt)}</p>
                            {log.changedBy && (
                              <p className="text-xs text-muted-foreground mt-0.5">{log.changedBy.fullName}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Payment modal — group-level */}
        <Dialog open={!!selectedGroup} onOpenChange={(o) => { if (!o) setSelectedGroup(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Payment Status</DialogTitle>
              <DialogDescription>
                Update payment for <strong>{selectedGroup?.clientName}</strong>
                {selectedGroup?.voucherNo ? ` — ${selectedGroup.voucherNo}` : ''}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground mb-1">
                  Invoice Total ({selectedGroup?.records.length} item{selectedGroup?.records.length !== 1 ? 's' : ''})
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
                  type="number"
                  placeholder="0.00"
                  value={amountPaid}
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
              <Button variant="outline" onClick={() => setSelectedGroup(null)} disabled={savingPayment}>
                Cancel
              </Button>
              <Button onClick={savePayment} disabled={savingPayment}>
                {savingPayment
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