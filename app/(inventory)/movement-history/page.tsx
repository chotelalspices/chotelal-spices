'use client';

import { useState, useEffect } from 'react';
import {
  History,
  Check,
  Filter,
  X,
  ChevronsUpDown,
  Loader2,
} from 'lucide-react';

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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

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

export default function MovementHistory() {
  const [materialFilter, setMaterialFilter] = useState<string>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // =============================
  // Fetch Raw Materials
  // =============================
  useEffect(() => {
    const fetchRawMaterials = async () => {
      try {
        const response = await fetch('/api/raw-materials');
        if (!response.ok) {
          throw new Error('Failed to fetch raw materials');
        }
        const data = await response.json();
        setRawMaterials(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    };

    fetchRawMaterials();
  }, []);

  // =============================
  // Fetch Stock Movements
  // =============================
  useEffect(() => {
    const fetchStockMovements = async () => {
      try {
        setLoading(true);

        const params = new URLSearchParams();

        if (materialFilter !== 'all') {
          params.append('materialId', materialFilter);
        }

        if (reasonFilter !== 'all') {
          params.append('reason', reasonFilter);
        }

        if (dateFrom) {
          params.append('dateFrom', dateFrom);
        }

        if (dateTo) {
          params.append('dateTo', dateTo);
        }

        const response = await fetch(
          `/api/stock-movements?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch stock movements');
        }

        const data = await response.json();
        setStockMovements(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchStockMovements();
  }, [materialFilter, reasonFilter, dateFrom, dateTo]);

  const hasActiveFilters =
    materialFilter !== 'all' ||
    reasonFilter !== 'all' ||
    dateFrom ||
    dateTo;

  const clearFilters = () => {
    setMaterialFilter('all');
    setReasonFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const filteredMovements = stockMovements;

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Movement History</h1>
          <p className="text-muted-foreground text-sm mt-1 hidden md:block">
            Complete audit trail of all stock changes
          </p>
        </div>
      </div>

      {/* =============================
          DESKTOP FILTERS
      ============================= */}
      <div className="hidden md:block industrial-card p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">

          {/* Raw Material */}
          <div className="space-y-2 min-w-[220px]">
            <Label className="text-xs text-muted-foreground">
              Raw Material
            </Label>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                >
                  {materialFilter === 'all'
                    ? 'All Materials'
                    : rawMaterials.find(m => m.id === materialFilter)?.name ||
                      'All Materials'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-[260px] p-0">
                <Command>
                  <CommandInput placeholder="Search material..." />
                  <CommandEmpty>No material found.</CommandEmpty>

                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => setMaterialFilter('all')}
                    >
                      All Materials
                      {materialFilter === 'all' && (
                        <Check className="ml-auto h-4 w-4" />
                      )}
                    </CommandItem>

                    {rawMaterials.map(material => (
                      <CommandItem
                        key={material.id}
                        value={material.name}
                        onSelect={() => setMaterialFilter(material.id)}
                      >
                        {material.name}
                        {materialFilter === material.id && (
                          <Check className="ml-auto h-4 w-4" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Reason Filter */}
          <div className="space-y-2 min-w-[180px]">
            <Label className="text-xs text-muted-foreground">
              Movement Reason
            </Label>

            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Reasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="purchase">Purchase</SelectItem>
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

      {/* =============================
          RESULTS COUNT
      ============================= */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Showing {filteredMovements.length} records
          {hasActiveFilters && ' (filtered)'}
        </p>
      </div>

      {/* =============================
          LOADING
      ============================= */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            Loading stock movements...
          </p>
        </div>
      )}

      {/* =============================
          ERROR
      ============================= */}
      {error && !loading && (
        <div className="text-center py-12">
          <History className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </div>
      )}

      {/* =============================
          TABLE / CARDS
      ============================= */}
      {!loading && !error && filteredMovements.length > 0 && (
        <>
          <div className="hidden md:block">
            <MovementTable movements={filteredMovements} />
          </div>

          <div className="md:hidden space-y-3">
            {filteredMovements.map(movement => (
              <MovementCard key={movement.id} movement={movement} />
            ))}
          </div>
        </>
      )}

      {!loading && !error && filteredMovements.length === 0 && (
        <div className="text-center py-12">
          <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No records found</p>
        </div>
      )}
    </AppLayout>
  );
}