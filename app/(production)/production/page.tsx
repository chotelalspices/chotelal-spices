'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Package,
  CheckCircle,
  Clock,
  Loader2,
  AlertCircle,
  PlayCircle,
  Trash2,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { ProductionBatch, formatCurrency } from '@/data/productionData';
import { formatDate, formatDateTime } from '@/data/sampleData';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';

export default function ProductionList() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/production/batches');
        if (!response.ok) throw new Error('Failed to fetch production batches');
        const data = await response.json();
        setBatches(data);
      } catch (error) {
        console.error('Error fetching production batches:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load production batches';
        setError(errorMessage);
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchBatches();
  }, [toast]);

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  }, []);

  const filteredBatches = batches.filter(batch => {
    const matchesSearch =
      batch.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.formulationName.toLowerCase().includes(searchTerm.toLowerCase());
    const batchDate = new Date(batch.productionDate);
    const matchesStartDate = !startDate || batchDate >= new Date(startDate);
    const matchesEndDate = !endDate || batchDate <= new Date(endDate + 'T23:59:59');
    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  const totalBatches = filteredBatches.length;
  const confirmedBatches = filteredBatches.filter(b => b.status === 'confirmed').length;
  const draftBatches = filteredBatches.filter(b => b.status === 'draft').length;
  const totalOutput = filteredBatches.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + b.finalOutputQuantity, 0);
  const totalCost = filteredBatches.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + b.totalProductionCost, 0);

  const handleContinueDraft = (batch: ProductionBatch) => {
    // Restore entry data and material requirements from draft batch into sessionStorage
    const entryData = {
      formulationId: batch.formulationId,
      formulationName: batch.formulationName,
      plannedQuantity: batch.plannedQuantity,
      availableQuantity: batch.availableQuantity ?? 0,
      producedQuantity: batch.producedQuantity ?? batch.plannedQuantity,
      numberOfLots: batch.numberOfLots ?? 1,
      finalQuantity: batch.finalOutputQuantity,
      unit: batch.unit,
      productionDate: batch.productionDate,
      batchId: batch.id, // Pass the draft batch ID so it can be updated instead of created
    };

    sessionStorage.setItem('productionEntry', JSON.stringify(entryData));

    // If draft has saved material requirements, restore them too
    if (batch.materialRequirements) {
      sessionStorage.setItem('materialRequirements', JSON.stringify(batch.materialRequirements));
    }

    router.push('/production/stock-check');
  };

  const handleDeleteBatch = async (batch: ProductionBatch) => {
    // Allow deletion of draft batches and confirmed batches without packaging data
    if (batch.hasPackagingData) {
      toast({
        title: 'Cannot Delete',
        description: 'Cannot delete production batch that has packaging data. Only batches without packaging can be deleted.',
        variant: 'destructive',
      });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete batch "${batch.batchNumber}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/production/batches/${batch.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete batch');
      }

      // Remove the deleted batch from the local state
      setBatches(prevBatches => prevBatches.filter(b => b.id !== batch.id));

      toast({
        title: 'Success',
        description: `Batch "${batch.batchNumber}" has been deleted successfully.`,
      });
    } catch (error) {
      console.error('Error deleting batch:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete batch',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading production batches...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && batches.length === 0) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Error loading batches</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Production Batches</h1>
            <p className="text-muted-foreground mt-1">Manage and track production batches</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => router.push('/production/planning')} className="gap-2">
              <Plus className="h-4 w-4" />
              Plan production
            </Button>
            <Button onClick={() => router.push('/production/new')} className="gap-2">
              <Plus className="h-4 w-4" />
              New Batch
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Batches</p>
              <p className="text-xl font-bold">{totalBatches}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Confirmed</p>
              <p className="text-xl font-bold">{confirmedBatches}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Drafts</p>
              <p className="text-xl font-bold text-amber-600">{draftBatches}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Output</p>
              <p className="text-xl font-bold">{totalOutput.toFixed(0)} kg</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-xl font-bold">{formatCurrency(totalCost)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Draft batches callout */}
        {draftBatches > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-amber-800">
                {draftBatches} incomplete {draftBatches === 1 ? 'batch' : 'batches'} pending
              </p>
              <p className="text-sm text-muted-foreground">
                Click <strong>Continue</strong> on any draft batch below to resume and complete it.
              </p>
            </div>
          </div>
        )}

        {/* DESKTOP FILTERS */}
        <Card className="hidden md:block">
          <CardContent className="py-4">
            <div className="flex items-end gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search batches..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
              </div>
              {(startDate || endDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setStartDate(''); setEndDate(''); }}>
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* MOBILE FILTERS */}
        <div className="md:hidden">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search batches..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Start Date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">End Date</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
                {(startDate || endDate) && (
                  <Button variant="outline" onClick={() => { setStartDate(''); setEndDate(''); }} className="w-full">
                    Clear Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* List */}
        {isMobile ? (
          <div className="space-y-3">
            {filteredBatches.map(batch => (
              <Card key={batch.id} className={batch.status === 'draft' ? 'border-amber-200' : ''}>
                <CardContent className="p-4">
                  <div className="flex justify-between mb-3">
                    <div>
                      <p className="font-mono text-sm text-primary">{batch.batchNumber}</p>
                      <p className="font-semibold">{batch.formulationName}</p>
                    </div>
                    <Badge variant={batch.status === 'confirmed' ? 'default' : 'secondary'}>
                      {batch.status === 'confirmed' ? (
                        <><CheckCircle className="h-3 w-3 mr-1" />Confirmed</>
                      ) : (
                        <><Clock className="h-3 w-3 mr-1" />Draft</>
                      )}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Output</p>
                      <p className="font-semibold">{batch.finalOutputQuantity.toFixed(2)} {batch.unit}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cost/kg</p>
                      <p className="font-semibold">{formatCurrency(batch.costPerKg)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Production Date</p>
                      <p className="font-semibold">{formatDate(batch.productionDate)}</p>
                    </div>
                    {batch.status === 'confirmed' && batch.confirmedAt && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Confirmed</p>
                        <p className="font-semibold">{batch.confirmedBy} • {formatDateTime(batch.confirmedAt)}</p>
                      </div>
                    )}
                  </div>

                  {/* Action buttons for draft batches and confirmed batches without packaging */}
                  {(batch.status === 'draft' || !batch.hasPackagingData) && (
                    <div className="mt-4 pt-3 border-t border-amber-100">
                      <div className="flex gap-2">
                        {batch.status === 'draft' && (
                          <Button
                            size="sm"
                            className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => handleContinueDraft(batch)}
                          >
                            <PlayCircle className="h-4 w-4" />
                            Continue
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteBatch(batch)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Number</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Planned Qty / Lot</TableHead>
                  <TableHead className="text-right">Final Output</TableHead>
                  <TableHead className="text-right">Cost/kg</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead>Production Date</TableHead>
                  <TableHead>Confirmed By</TableHead>
                  <TableHead>Confirmed At</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBatches.map(batch => (
                  <TableRow key={batch.id} className={batch.status === 'draft' ? 'bg-amber-50/40' : ''}>
                    <TableCell className="font-mono text-primary">{batch.batchNumber}</TableCell>
                    <TableCell>{batch.formulationName}</TableCell>
                    <TableCell className="text-right">{batch.plannedQuantity} {batch.unit}</TableCell>
                    <TableCell className="text-right">{batch.finalOutputQuantity.toFixed(2)} {batch.unit}</TableCell>
                    <TableCell className="text-right">{formatCurrency(batch.costPerKg)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(batch.finalOutputQuantity * batch.costPerKg)}
                    </TableCell>
                    <TableCell>{formatDate(batch.productionDate)}</TableCell>
                    <TableCell>{batch.status === 'confirmed' ? batch.confirmedBy : '—'}</TableCell>
                    <TableCell>
                      {batch.status === 'confirmed' && batch.confirmedAt
                        ? formatDateTime(batch.confirmedAt)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={batch.status === 'confirmed' ? 'default' : 'secondary'}>
                        {batch.status === 'confirmed' ? (
                          <><CheckCircle className="h-3 w-3 mr-1" />Confirmed</>
                        ) : (
                          <><Clock className="h-3 w-3 mr-1" />Draft</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {batch.status === 'draft' || !batch.hasPackagingData ? (
                        <div className="flex justify-center gap-2">
                          {batch.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 border-amber-400 text-amber-700 hover:bg-amber-50"
                              onClick={() => handleContinueDraft(batch)}
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                              Continue
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteBatch(batch)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {filteredBatches.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No batches found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'Try adjusting your search' : 'Create your first production batch'}
            </p>
          </div>
        )}

        {isMobile && (
          <Button
            onClick={() => router.push('/production/new')}
            className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
            size="icon"
          >
            <Plus className="h-6 w-6" />
          </Button>
        )}
      </div>
    </AppLayout>
  );
}