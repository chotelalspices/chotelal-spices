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
  HistoryIcon
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/inventory/StatCard';
import { MaterialCard } from '@/components/inventory/MaterialCard';
import { MaterialTable } from '@/components/inventory/MaterialTable';
import { RawMaterial, getStockStatus, formatQuantity } from '@/data/sampleData';
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

export default function InventoryDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch raw materials from API
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/inventory');
        if (!response.ok) {
          throw new Error('Failed to fetch raw materials');
        }
        const data = await response.json();
        setRawMaterials(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching materials:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMaterials();
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const totalMaterials = rawMaterials.length;
    const totalStock = rawMaterials.reduce((sum, m) => {
      const stockInKg = m.unit === 'gm' ? m.availableStock / 1000 : m.availableStock;
      return sum + stockInKg;
    }, 0);
    const lowStockItems = rawMaterials.filter(m => getStockStatus(m) === 'low').length;
    const outOfStockItems = rawMaterials.filter(m => getStockStatus(m) === 'out').length;

    return { totalMaterials, totalStock, lowStockItems, outOfStockItems };
  }, [rawMaterials]);

  // Filter materials
  const filteredMaterials = useMemo(() => {
    return rawMaterials.filter(material => {
      if (searchQuery && !material.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      if (statusFilter !== 'all' && material.status !== statusFilter) return false;

      if (stockFilter !== 'all') {
        const stockStatus = getStockStatus(material);
        if (stockFilter === 'low' && stockStatus !== 'low') return false;
        if (stockFilter === 'out' && stockStatus !== 'out') return false;
        if (stockFilter === 'normal' && stockStatus !== 'normal') return false;
      }

      return true;
    });
  }, [rawMaterials, searchQuery, statusFilter, stockFilter]);

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
            <p className="text-muted-foreground">Loading inventory...</p>
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
            <h3 className="text-lg font-medium text-foreground mb-1">Error loading inventory</h3>
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
          <h1 className="page-title">Raw Materials Inventory</h1>
          <p className="text-muted-foreground text-sm mt-1 hidden md:block">
            Manage your spice raw materials and stock levels
          </p>
        </div>
        <div className='flex gap-2'>
          <Button asChild className="hidden md:flex">
            <Link href="/movement-history">
              <HistoryIcon className="h-4 w-4 mr-2" />
              Movement History
            </Link>
          </Button>
          <Button asChild className="hidden md:flex">
            <Link href="/add-material">
              <Plus className="h-4 w-4 mr-2" />
              Add Raw Material
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="flex gap-4 overflow-x-auto pb-2 mb-6 scrollbar-hide md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
        <div className="min-w-[160px] md:min-w-0">
          <StatCard
            title="Total Raw Materials"
            value={stats.totalMaterials}
            subtitle="Active inventory items"
            icon={Package}
            variant="default"
          />
        </div>
        <div className="min-w-[160px] md:min-w-0">
          <StatCard
            title="Total Stock"
            value={`${stats.totalStock.toLocaleString('en-IN')} kg`}
            subtitle="Across all materials"
            icon={Boxes}
            variant="success"
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
            placeholder="Search raw materials..."
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
            <Button variant="outline" size="icon" className="md:hidden shrink-0">
              <Filter className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto rounded-t-xl">
            <SheetHeader className="text-left mb-4">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Status</label>
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
                <label className="text-sm font-medium text-foreground mb-2 block">Stock Level</label>
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
                <Button variant="outline" onClick={clearFilters} className="flex-1">
                  Clear Filters
                </Button>
                <Button onClick={() => setMobileFilterOpen(false)} className="flex-1">
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
          Showing {filteredMaterials.length} of {rawMaterials.length} materials
        </p>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <MaterialTable materials={filteredMaterials} />
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredMaterials.map((material) => (
          <MaterialCard key={material.id} material={material} />
        ))}
      </div>

      {/* Empty State */}
      {filteredMaterials.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">No materials found</h3>
          <p className="text-muted-foreground">
            {searchQuery || hasActiveFilters
              ? 'Try adjusting your search or filters'
              : 'Add your first raw material to get started'}
          </p>
        </div>
      )}

      {/* Mobile FAB */}
      <Link
        href="/add-material"
        className="md:hidden fixed right-4 bottom-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors z-40"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </AppLayout>
  );
}
