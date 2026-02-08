'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';

import { StatCard } from '@/components/inventory/StatCard';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

import {
  calculateSalesSummary,
  formatCurrency,
  formatSaleDate,
  formatQuantity,
  type SalesRecord,
} from '@/data/salesData';

/* ---------------------------------- */
/* SETTINGS */
/* ---------------------------------- */
const SHOW_PROFIT_TO_STAFF = true;

/* ---------------------------------- */
/* COMPONENT */
/* ---------------------------------- */
export default function SalesSummary() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  // Fetch sales records on mount
  useEffect(() => {
    const fetchSalesRecords = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/sales/records');
        if (!response.ok) {
          throw new Error('Failed to fetch sales records');
        }
        const data = await response.json();
        setSalesRecords(data);
      } catch (error) {
        console.error('Error fetching sales records:', error);
        toast.error('Failed to load sales records. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSalesRecords();
  }, []);

  /* -------- PRODUCTS -------- */
  const uniqueProducts = useMemo(() => {
    return [...new Set(salesRecords.map(r => r.productName))].sort();
  }, [salesRecords]);

  /* -------- FILTERING -------- */
  const filteredRecords = useMemo(() => {
    return salesRecords.filter(record => {
      if (productFilter !== 'all' && record.productName !== productFilter) {
        return false;
      }
      if (startDate && new Date(record.saleDate) < new Date(startDate)) {
        return false;
      }
      if (endDate && new Date(record.saleDate) > new Date(endDate)) {
        return false;
      }
      return true;
    });
  }, [salesRecords, productFilter, startDate, endDate]);

  const summary = useMemo(
    () => calculateSalesSummary(filteredRecords),
    [filteredRecords]
  );

  const clearFilters = () => {
    setProductFilter('all');
    setStartDate('');
    setEndDate('');
    setFilterOpen(false);
  };

  const handleDeleteSale = async (saleId: string) => {
    try {
      const response = await fetch(`/api/sales/records/${saleId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete sales record');
      }

      toast.success('Sales record deleted successfully');
      
      // Refresh the sales records
      const fetchSalesRecords = async () => {
        try {
          const response = await fetch('/api/sales/records');
          if (!response.ok) {
            throw new Error('Failed to fetch sales records');
          }
          const data = await response.json();
          setSalesRecords(data);
        } catch (error) {
          console.error('Error fetching sales records:', error);
          toast.error('Failed to refresh sales records');
        }
      };

      fetchSalesRecords();
    } catch (error) {
      console.error('Error deleting sales record:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete sales record');
    }
  };

  const hasActiveFilters =
    productFilter !== 'all' || startDate || endDate;

  /* -------- FILTER CONTENT -------- */
  const FilterContent = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Product</Label>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {uniqueProducts.map(product => (
              <SelectItem key={product} value={product}>
                {product}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Start Date</Label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>End Date</Label>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      {hasActiveFilters && (
        <Button
          variant="outline"
          onClick={clearFilters}
          className="w-full"
        >
          Clear Filters
        </Button>
      )}
    </div>
  );

  /* ---------------------------------- */
  /* RENDER */
  /* ---------------------------------- */
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Sales Summary</h1>
            <p className="text-sm text-muted-foreground">
              View and analyze sales records
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/sales/upload')}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>

            <Button onClick={() => router.push('/sales/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Sale
            </Button>
          </div>
        </div>

        {/* STATS */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Sales"
              value={summary.salesCount.toString()}
              icon={Package}
            />
            <StatCard
              title="Revenue"
              value={formatCurrency(summary.totalRevenue)}
              icon={IndianRupee}
            />
            <StatCard
              title="Quantity Sold"
              value={`${summary.totalQuantity} packets`}
              icon={TrendingUp}
            />
            {SHOW_PROFIT_TO_STAFF && (
              <StatCard
                title="Profit"
                value={formatCurrency(summary.totalProfit)}
                icon={TrendingUp}
              />
            )}
          </div>
        )}

        {/* DESKTOP FILTERS */}
        <Card className="hidden md:block">
          <CardContent className="py-4">
            <div className="flex items-end gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Product
                </Label>
                <Select
                  value={productFilter}
                  onValueChange={setProductFilter}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {uniqueProducts.map(product => (
                      <SelectItem key={product} value={product}>
                        {product}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Start
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  End
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* MOBILE FILTER */}
        <div className="md:hidden">
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="w-full gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="secondary">Active</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>Filter Sales</SheetTitle>
              </SheetHeader>
              <FilterContent />
            </SheetContent>
          </Sheet>
        </div>

        {/* DESKTOP TABLE */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-muted-foreground">
                  {salesRecords.length === 0 ? 'No sales records found' : 'No sales records match the current filters'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {SHOW_PROFIT_TO_STAFF && (
                      <TableHead className="text-right">
                        Profit
                      </TableHead>
                    )}
                    {isAdmin && (
                      <TableHead className="text-right">
                        Actions
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredRecords.map(record => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatSaleDate(record.saleDate)}
                        </div>
                      </TableCell>

                      <TableCell className="font-medium">
                        {record.productName}
                      </TableCell>

                      <TableCell className="text-right">
                        {record.quantitySold}
                      </TableCell>

                      <TableCell className="text-right">
                        {record.sellingPricePerUnit === 0 ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            FREE
                          </Badge>
                        ) : (
                          formatCurrency(record.sellingPricePerUnit)
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {record.discount > 0 ? (
                          <span className="text-green-600">
                            -{record.discount}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right font-medium">
                        {record.totalAmount === 0 ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            FREE
                          </Badge>
                        ) : (
                          formatCurrency(record.totalAmount)
                        )}
                      </TableCell>

                      {SHOW_PROFIT_TO_STAFF && (
                        <TableCell className="text-right">
                          {record.sellingPricePerUnit === 0 ? (
                            <span className="text-muted-foreground">N/A</span>
                          ) : (
                            <div
                              className={`flex justify-end items-center gap-1 ${
                                record.profit >= 0
                                  ? 'text-green-600'
                                  : 'text-destructive'
                              }`}
                            >
                              {record.profit >= 0 ? (
                                <ArrowUpRight className="h-4 w-4" />
                              ) : (
                                <ArrowDownRight className="h-4 w-4" />
                              )}
                              {formatCurrency(
                                Math.abs(record.profit)
                              )}
                            </div>
                          )}
                        </TableCell>
                      )}

                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                router.push(
                                  `/sales/${record.id}/edit`
                                )
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Sales Record</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this sales record? This action cannot be undone.
                                    The product quantity will be restored to inventory.
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
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* MOBILE CARDS */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-muted-foreground">
                    {salesRecords.length === 0 ? 'No sales records found' : 'No sales records match the current filters'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredRecords.map(record => (
              <Card key={record.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between mb-3">
                    <div>
                      <p className="font-medium">
                        {record.productName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatSaleDate(record.saleDate)}
                      </p>
                    </div>

                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            router.push(
                              `/sales/${record.id}/edit`
                            )
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Sales Record</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this sales record? This action cannot be undone.
                                The product quantity will be restored to inventory.
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
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Qty</p>
                      <p>
                        {record.quantitySold}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        Price
                      </p>
                      <p>
                        {formatCurrency(
                          record.sellingPricePerUnit
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        Discount
                      </p>
                      <p>
                        {record.discount > 0 ? (
                          <span className="text-green-600">
                            -{record.discount}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        Amount
                      </p>
                      <p className="font-semibold">
                        {formatCurrency(
                          record.totalAmount
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
