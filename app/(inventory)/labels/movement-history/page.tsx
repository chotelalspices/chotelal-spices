'use client';

import { useState, useEffect } from 'react';
import {
  History,
  Check,
  Filter,
  X,
  ChevronsUpDown,
  Loader2,
  Tag,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { LabelMovementCard } from '@/components/inventory/Labelmovementcard';
import { LabelMovementTable } from '@/components/inventory/Labelmovementtable';

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

interface LabelItem {
  id: string;
  name: string;
}

interface LabelMovement {
  id: string;
  labelId: string;
  labelName: string;
  action: 'add' | 'reduce';
  quantity: number;
  reason: string;
  remarks?: string;
  adjustmentDate: string;
  createdAt: string;
}

export default function LabelMovementHistoryPage() {
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [movements, setMovements] = useState<LabelMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch labels for the filter dropdown
  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const response = await fetch('/api/labels');
        if (!response.ok) throw new Error('Failed to fetch labels');
        const data = await response.json();
        setLabels(data);
      } catch (err) {
        console.error('Error fetching labels:', err);
      }
    };
    fetchLabels();
  }, []);

  // Fetch movements whenever filters change
  useEffect(() => {
    const fetchMovements = async () => {
      try {
        setLoading(true);

        const params = new URLSearchParams();
        if (labelFilter !== 'all') params.append('labelId', labelFilter);
        if (reasonFilter !== 'all') params.append('reason', reasonFilter);
        if (dateFrom) params.append('dateFrom', dateFrom);
        if (dateTo) params.append('dateTo', dateTo);

        const response = await fetch(`/api/labels/movements?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch label movements');

        const data = await response.json();
        setMovements(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    fetchMovements();
  }, [labelFilter, reasonFilter, dateFrom, dateTo]);

  const hasActiveFilters =
    labelFilter !== 'all' || reasonFilter !== 'all' || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setLabelFilter('all');
    setReasonFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Label Movement History</h1>
          <p className="text-muted-foreground text-sm mt-1 hidden md:block">
            Complete audit trail of all label stock changes
          </p>
        </div>
      </div>

      {/* Desktop Filters */}
      <div className="hidden md:block industrial-card p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">

          {/* Label Filter — searchable combobox */}
          <div className="space-y-2 min-w-[220px]">
            <Label className="text-xs text-muted-foreground">Label</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {labelFilter === 'all'
                    ? 'All Labels'
                    : labels.find((l) => l.id === labelFilter)?.name || 'All Labels'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[260px] p-0">
                <Command>
                  <CommandInput placeholder="Search label..." />
                  <CommandEmpty>No label found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="all" onSelect={() => setLabelFilter('all')}>
                      All Labels
                      {labelFilter === 'all' && <Check className="ml-auto h-4 w-4" />}
                    </CommandItem>
                    {labels.map((label) => (
                      <CommandItem
                        key={label.id}
                        value={label.name}
                        onSelect={() => setLabelFilter(label.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{label.name}</span>
                        </div>
                        {labelFilter === label.id && (
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
            <Label className="text-xs text-muted-foreground">Movement Reason</Label>
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Reasons" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">All Reasons</SelectItem>
                <SelectItem value="purchase">Purchase Received</SelectItem>
                <SelectItem value="wastage">Wastage / Misprint</SelectItem>
                <SelectItem value="damage">Damage</SelectItem>
                <SelectItem value="correction">Stock Correction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div className="space-y-2 min-w-[150px]">
            <Label className="text-xs text-muted-foreground">Date From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo || undefined}
            />
          </div>

          {/* Date To */}
          <div className="space-y-2 min-w-[150px]">
            <Label className="text-xs text-muted-foreground">Date To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
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

      {/* Mobile Filter Button */}
      <div className="md:hidden mb-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setMobileFilterOpen(true)}>
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs w-4 h-4 flex items-center justify-center">
              !
            </span>
          )}
        </Button>
      </div>

      {/* Mobile Filter Sheet */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="relative w-full bg-background rounded-t-xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-foreground">Filters</h2>
              <Button variant="ghost" size="icon" onClick={() => setMobileFilterOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Label</Label>
              <Select value={labelFilter} onValueChange={setLabelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Labels" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Labels</SelectItem>
                  {labels.map((label) => (
                    <SelectItem key={label.id} value={label.id}>
                      {label.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Movement Reason</Label>
              <Select value={reasonFilter} onValueChange={setReasonFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Reasons" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Reasons</SelectItem>
                  <SelectItem value="purchase">Purchase Received</SelectItem>
                  <SelectItem value="wastage">Wastage / Misprint</SelectItem>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="correction">Stock Correction</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Date From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  max={dateTo || undefined}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Date To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom || undefined}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={clearFilters} className="flex-1">
                Clear Filters
              </Button>
              <Button onClick={() => setMobileFilterOpen(false)} className="flex-1">
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Showing {movements.length} records{hasActiveFilters && ' (filtered)'}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading label movements...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-12">
          <History className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </div>
      )}

      {/* Desktop Table / Mobile Cards */}
      {!loading && !error && movements.length > 0 && (
        <>
          <div className="hidden md:block">
            <LabelMovementTable movements={movements} />
          </div>
          <div className="md:hidden space-y-3">
            {movements.map((movement) => (
              <LabelMovementCard key={movement.id} movement={movement} />
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {!loading && !error && movements.length === 0 && (
        <div className="text-center py-12">
          <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No records found</h3>
          <p className="text-muted-foreground">
            {hasActiveFilters
              ? 'Try adjusting your filters'
              : 'Label stock movements will appear here'}
          </p>
        </div>
      )}
    </AppLayout>
  );
}