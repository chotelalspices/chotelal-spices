'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  Boxes,
  AlertTriangle,
  XCircle,
  Plus,
  Search,
  Filter,
  X,
  HistoryIcon,
  IndianRupee,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/inventory/StatCard';
import { LabelCard } from '@/components/inventory/LabelCard';
import { LabelTable } from '@/components/inventory/LabelTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface Label {
  id: string;
  name: string;
  status: string;
  availableStock: number;
  minimumStock: number;
  costPerUnit: number;
  unit?: string;
}

const getStockStatus = (label: Label) => {
  if (label.availableStock === 0) return 'out';
  if (label.availableStock <= label.minimumStock) return 'low';
  return 'normal';
};

export default function LabelInventoryDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLabels = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/labels');
        if (!response.ok) throw new Error('Failed to fetch labels');
        const data = await response.json();
        setLabels(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching labels:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLabels();
  }, []);

  const stats = useMemo(() => {
    const totalLabels = labels.length;
    const totalStock = labels.reduce((sum, l) => sum + l.availableStock, 0);
    const lowStockItems = labels.filter((l) => getStockStatus(l) === 'low').length;
    const outOfStockItems = labels.filter((l) => getStockStatus(l) === 'out').length;
    const totalInventoryValue = labels.reduce(
      (sum, l) => sum + l.availableStock * (l.costPerUnit ?? 0),
      0
    );
    return { totalLabels, totalStock, lowStockItems, outOfStockItems, totalInventoryValue };
  }, [labels]);

  const filteredLabels = useMemo(() => {
    return labels.filter((label) => {
      if (
        searchQuery &&
        !label.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      if (statusFilter !== 'all' && label.status !== statusFilter) return false;
      if (stockFilter !== 'all') {
        const stockStatus = getStockStatus(label);
        if (stockFilter === 'low' && stockStatus !== 'low') return false;
        if (stockFilter === 'out' && stockStatus !== 'out') return false;
        if (stockFilter === 'normal' && stockStatus !== 'normal') return false;
      }
      return true;
    });
  }, [labels, searchQuery, statusFilter, stockFilter]);

  const hasActiveFilters = statusFilter !== 'all' || stockFilter !== 'all';
  const clearFilters = () => {
    setStatusFilter('all');
    setStockFilter('all');
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading labels inventory...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">
              Error loading inventory
            </h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Labels Inventory</h1>
          <p className="text-muted-foreground text-sm mt-1 hidden md:block">
            Manage physical printed label stock used in packaging
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild className="hidden md:flex">
            <Link href="/labels/movement-history">
              <HistoryIcon className="h-4 w-4 mr-2" />
              Movement History
            </Link>
          </Button>
          <Button asChild className="hidden md:flex">
            <Link href="/labels/add-label">
              <Plus className="h-4 w-4 mr-2" />
              Add New Label
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="flex gap-4 overflow-x-auto pb-2 mb-6 scrollbar-hide md:grid md:grid-cols-5 md:overflow-visible md:pb-0">
        <div className="min-w-[160px] md:min-w-0">
          <StatCard
            title="Total Labels"
            value={stats.totalLabels}
            subtitle="Active label items"
            icon={Package}
            variant="default"
          />
        </div>
        <div className="min-w-[160px] md:min-w-0">
          <StatCard
            title="Total Stock"
            value={stats.totalStock.toLocaleString('en-IN', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
            subtitle="Total label units"
            icon={Boxes}
            variant="success"
          />
        </div>
        <div className="min-w-[160px] md:min-w-0">
          <StatCard
            title="Inventory Value"
            value={`₹${stats.totalInventoryValue.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            subtitle="Stock × cost per unit"
            icon={IndianRupee}
            variant="default"
          />
        </div>
        <div className="min-w-[160px] md:min-w-0">
          <StatCard
            title="Low Stock Items"
            value={stats.lowStockItems}
            subtitle="Need restocking soon"
            icon={AlertTriangle}
            variant="warning"
          />
        </div>
        <div className="min-w-[160px] md:min-w-0">
          <StatCard
            title="Out of Stock"
            value={stats.outOfStockItems}
            subtitle="Immediate attention"
            icon={XCircle}
            variant="danger"
          />
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search labels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Desktop Filters */}
        <div className="hidden md:flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Stock Level" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Stock Levels</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Mobile Filter Button */}
        <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="md:hidden shrink-0"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto rounded-t-xl">
            <SheetHeader className="text-left mb-4">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Stock Level
                </label>
                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Stock Level" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="all">All Stock Levels</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low Stock</SelectItem>
                    <SelectItem value="out">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="flex-1"
                >
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

      {/* Results count */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Showing {filteredLabels.length} of {labels.length} labels
        </p>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <LabelTable labels={filteredLabels} />
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredLabels.map((label) => (
          <LabelCard key={label.id} label={label} />
        ))}
      </div>

      {/* Empty State */}
      {filteredLabels.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            No labels found
          </h3>
          <p className="text-muted-foreground">
            {searchQuery || hasActiveFilters
              ? 'Try adjusting your search or filters'
              : 'Add your first label to get started'}
          </p>
        </div>
      )}

      {/* Mobile FAB */}
      <Link
        href="/labels/add-label"
        className="md:hidden fixed right-4 bottom-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors z-40"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </AppLayout>
  );
}