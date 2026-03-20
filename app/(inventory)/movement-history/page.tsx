'use client';

import { useState, useEffect } from 'react';
import {
  History,
  Check,
  X,
  ChevronsUpDown,
  Loader2,
  Download,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { MovementCard } from '@/components/inventory/MovementCard';
import { MovementTable } from '@/components/inventory/MovementTable';
import { RawMaterial, StockMovement } from '@/types/inventory';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const reasonLabels: Record<string, string> = {
  purchase: 'Purchase',
  wastage: 'Wastage',
  damage: 'Damage',
  correction: 'Correction',
  production: 'Production',
};

export default function MovementHistory() {
  // ── All hooks must come before any early return ──────────────────────────
  const { isAdmin, isLoading } = useAuth();
  const router = useRouter();

  const [materialFilter, setMaterialFilter] = useState<string>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect non-admins only AFTER auth has finished loading
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace('/inventory');
    }
  }, [isAdmin, isLoading, router]);

  // Fetch raw materials
  useEffect(() => {
    const fetchRawMaterials = async () => {
      try {
        const response = await fetch('/api/inventory');
        if (!response.ok) throw new Error('Failed to fetch raw materials');
        setRawMaterials(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    };
    fetchRawMaterials();
  }, []);

  // Fetch stock movements
  useEffect(() => {
    const fetchStockMovements = async () => {
      try {
        setDataLoading(true);
        const params = new URLSearchParams();
        if (materialFilter !== 'all') params.append('materialId', materialFilter);
        if (reasonFilter !== 'all')   params.append('reason', reasonFilter);
        if (dateFrom)                 params.append('dateFrom', dateFrom);
        if (dateTo)                   params.append('dateTo', dateTo);

        const response = await fetch(`/api/stock-movements?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch stock movements');
        setStockMovements(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setDataLoading(false);
      }
    };
    fetchStockMovements();
  }, [materialFilter, reasonFilter, dateFrom, dateTo]);

  // ── Early returns AFTER all hooks ────────────────────────────────────────

  // Show spinner while auth is still resolving
  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // Block non-admins (redirect also fires via useEffect above)
  if (!isAdmin) return null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const hasActiveFilters = materialFilter !== 'all' || reasonFilter !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setMaterialFilter('all');
    setReasonFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const handleDownloadPDF = () => {
    const selectedMaterialName = materialFilter === 'all'
      ? 'All Materials'
      : rawMaterials.find(m => m.id === materialFilter)?.name || 'All Materials';

    const rows = stockMovements.map((m, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${new Date(m.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>${m.rawMaterialName}</td>
        <td>${m.action === 'add' ? 'Add' : 'Reduce'}</td>
        <td class="${m.action === 'add' ? 'add' : 'reduce'}">${m.action === 'add' ? '+' : '-'}${Number(m.quantity).toFixed(2)}</td>
        <td>${reasonLabels[m.reason] || m.reason}</td>
        <td>${m.reference || '—'}</td>
        <td>${m.performedBy || '—'}</td>
      </tr>
    `).join('');

    const filterSummary = [
      selectedMaterialName !== 'All Materials' ? `Material: ${selectedMaterialName}` : null,
      reasonFilter !== 'all' ? `Reason: ${reasonLabels[reasonFilter] || reasonFilter}` : null,
      dateFrom ? `From: ${dateFrom}` : null,
      dateTo ? `To: ${dateTo}` : null,
    ].filter(Boolean).join(' · ') || 'No filters applied';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Stock Movement History</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 11px; border-bottom: 2px solid #e5e7eb; }
          td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
          tr:nth-child(even) td { background: #f9fafb; }
          .add { color: #16a34a; font-weight: 600; }
          .reduce { color: #dc2626; font-weight: 600; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Stock Movement History</h1>
        <p class="meta">
          Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          &nbsp;·&nbsp; ${stockMovements.length} records
          &nbsp;·&nbsp; ${filterSummary}
        </p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Raw Material</th>
              <th>Action</th>
              <th>Quantity</th>
              <th>Reason</th>
              <th>Reference</th>
              <th>Performed By</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Movement History</h1>
          <p className="text-muted-foreground text-sm mt-1 hidden md:block">
            Complete audit trail of all stock changes
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleDownloadPDF}
          disabled={dataLoading || stockMovements.length === 0}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>

      {/* Desktop Filters */}
      <div className="hidden md:block industrial-card p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">

          {/* Raw Material — searchable */}
          <div className="space-y-2 min-w-[220px]">
            <Label className="text-xs text-muted-foreground">Raw Material</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {materialFilter === 'all'
                    ? 'All Materials'
                    : rawMaterials.find(m => m.id === materialFilter)?.name || 'All Materials'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[260px] p-0">
                <Command>
                  <CommandInput placeholder="Search material..." />
                  <CommandEmpty>No material found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="all" onSelect={() => setMaterialFilter('all')}>
                      All Materials
                      {materialFilter === 'all' && <Check className="ml-auto h-4 w-4" />}
                    </CommandItem>
                    {rawMaterials.map(material => (
                      <CommandItem
                        key={material.id}
                        value={material.name}
                        onSelect={() => setMaterialFilter(material.id)}
                      >
                        {material.name}
                        {materialFilter === material.id && <Check className="ml-auto h-4 w-4" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Reason */}
          <div className="space-y-2 min-w-[180px]">
            <Label className="text-xs text-muted-foreground">Movement Reason</Label>
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Reasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                <SelectItem value="purchase">Purchase</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="wastage">Wastage</SelectItem>
                <SelectItem value="damage">Damage</SelectItem>
                <SelectItem value="correction">Correction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div className="space-y-2 min-w-[150px]">
            <Label className="text-xs text-muted-foreground">Date From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              max={dateTo || undefined}
            />
          </div>

          {/* Date To */}
          <div className="space-y-2 min-w-[150px]">
            <Label className="text-xs text-muted-foreground">Date To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Showing {stockMovements.length} records{hasActiveFilters && ' (filtered)'}
        </p>
      </div>

      {/* Data loading */}
      {dataLoading && (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading stock movements...</p>
        </div>
      )}

      {/* Error */}
      {error && !dataLoading && (
        <div className="text-center py-12">
          <History className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </div>
      )}

      {/* Table */}
      {!dataLoading && !error && stockMovements.length > 0 && (
        <>
          <div className="hidden md:block">
            <MovementTable movements={stockMovements} />
          </div>
          <div className="md:hidden space-y-3">
            {stockMovements.map(movement => (
              <MovementCard key={movement.id} movement={movement} />
            ))}
          </div>
        </>
      )}

      {!dataLoading && !error && stockMovements.length === 0 && (
        <div className="text-center py-12">
          <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No records found</p>
        </div>
      )}
    </AppLayout>
  );
}