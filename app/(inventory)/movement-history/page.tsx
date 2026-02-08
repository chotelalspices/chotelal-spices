'use client';

import { useState, useMemo, useEffect } from 'react';
import { History, Check, Filter, X, ChevronsUpDown, Loader2 } from 'lucide-react';

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
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  
  // API states
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch raw materials
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

  // Fetch stock movements with filters
  useEffect(() => {
    const fetchStockMovements = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        
        if (materialFilter && materialFilter !== 'all') {
          params.append('materialId', materialFilter);
        }
        if (typeFilter && typeFilter !== 'all') {
          params.append('type', typeFilter);
        }
        if (dateFrom) {
          params.append('dateFrom', dateFrom);
        }
        if (dateTo) {
          params.append('dateTo', dateTo);
        }

        const response = await fetch(`/api/stock-movements?${params.toString()}`);
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
  }, [materialFilter, typeFilter, dateFrom, dateTo]);

  // Filtered movements are now handled by the API
  const filteredMovements = stockMovements;

  const hasActiveFilters =
    materialFilter !== 'all' || typeFilter !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setMaterialFilter('all');
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
  };

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

      {/* Desktop Filters */}
      <div className="hidden md:block industrial-card p-4 mb-6 animate-fade-in">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2 min-w-[200px]">
            <Label className="text-xs text-muted-foreground">Raw Material</Label>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {materialFilter === 'all'
                    ? 'All Materials'
                    : rawMaterials.find(m => m.id === materialFilter)?.name ||
                      'All Materials'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-[240px] p-0">
                <Command>
                  <CommandInput placeholder="Search material..." />
                  <CommandEmpty>No material found.</CommandEmpty>

                  <CommandGroup>
                    <CommandItem value="all" onSelect={() => setMaterialFilter('all')}>
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

          <div className="space-y-2 min-w-[160px]">
            <Label className="text-xs text-muted-foreground">Movement Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="adjustment">Adjustments Only</SelectItem>
                <SelectItem value="production">Production Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 min-w-[150px]">
            <Label className="text-xs text-muted-foreground">Date From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              max={dateTo || undefined}
            />
          </div>

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
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="mb-0.5"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Search / Filter */}
      <div className="md:hidden flex items-center gap-3 mb-4">
        <div className="flex-1">
          <Select value={materialFilter} onValueChange={setMaterialFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Materials" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Materials</SelectItem>
              {rawMaterials.map(material => (
                <SelectItem key={material.id} value={material.id}>
                  {material.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </SheetTrigger>

          <SheetContent side="bottom" className="h-auto rounded-t-xl">
            <SheetHeader className="text-left mb-4">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Movement Type
                </Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="adjustment">Adjustments Only</SelectItem>
                    <SelectItem value="production">Production Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Date From
                  </Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Date To
                  </Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={clearFilters} className="flex-1">
                  Clear Filters
                </Button>
                <Button
                  onClick={() => setMobileFilterOpen(false)}
                  className="flex-1"
                >
                  Apply
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Results Count */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Showing {filteredMovements.length} of {stockMovements.length} records
          {hasActiveFilters && ' (filtered)'}
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading stock movements...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-12">
          <History className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            Error loading data
          </h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredMovements.length === 0 && (
        <div className="text-center py-12">
          <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            No records found
          </h3>
          <p className="text-muted-foreground">
            {hasActiveFilters
              ? 'Try adjusting your filters'
              : 'Stock movements will appear here once adjustments are made'}
          </p>
        </div>
      )}

      {/* Desktop Table */}
      {!loading && !error && filteredMovements.length > 0 && (
        <div className="hidden md:block">
          <MovementTable movements={filteredMovements} />
        </div>
      )}

      {/* Mobile Cards */}
      {!loading && !error && filteredMovements.length > 0 && (
        <div className="md:hidden space-y-3">
          {filteredMovements.map(movement => (
            <MovementCard key={movement.id} movement={movement} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
