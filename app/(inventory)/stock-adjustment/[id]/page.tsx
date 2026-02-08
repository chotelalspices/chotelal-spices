'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Check,
  ChevronsUpDown,
  Loader2,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { formatQuantity, formatCurrency, type RawMaterial } from '@/data/sampleData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { cn } from '@/libs/utils';
import { useToast } from '@/hooks/use-toast';

type AdjustmentType = 'add' | 'reduce';
type ReasonType = 'purchase' | 'wastage' | 'damage' | 'correction';

interface FormData {
  materialId: string;
  adjustmentType: AdjustmentType;
  quantity: string;
  reason: ReasonType | '';
  adjustmentDate: string;
  remarks: string;
}

export default function StockAdjustmentPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const materialIdFromUrl = params?.id as string;

  const [formData, setFormData] = useState<FormData>({
    materialId: materialIdFromUrl || '',
    adjustmentType: 'add',
    quantity: '',
    reason: '',
    adjustmentDate: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        
        // If materialIdFromUrl exists and materials are loaded, set it in formData
        if (materialIdFromUrl && data.find((m: RawMaterial) => m.id === materialIdFromUrl)) {
          setFormData(prev => ({
            ...prev,
            materialId: materialIdFromUrl,
          }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching materials:', err);
        toast({
          title: 'Error',
          description: 'Failed to load raw materials. Please refresh the page.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMaterials();
  }, [materialIdFromUrl, toast]);

  const selectedMaterial = useMemo(
    () => rawMaterials.find(m => m.id === formData.materialId),
    [rawMaterials, formData.materialId]
  );

  const adjustmentPreview = useMemo(() => {
    if (!selectedMaterial || !formData.quantity) return null;

    const qty = parseFloat(formData.quantity);
    if (isNaN(qty) || qty <= 0) return null;

    const currentStock = selectedMaterial.availableStock;
    const newStock =
      formData.adjustmentType === 'add'
        ? currentStock + qty
        : currentStock - qty;

    return {
      currentStock,
      quantity: qty,
      newStock,
      isValid: newStock >= 0,
    };
  }, [selectedMaterial, formData.quantity, formData.adjustmentType]);

  const validateForm = () => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.materialId) {
      newErrors.materialId = 'Please select a raw material';
    }

    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      newErrors.quantity = 'Enter a valid positive quantity';
    }

    if (!formData.reason) {
      newErrors.reason = 'Please select a reason';
    }

    if (adjustmentPreview && !adjustmentPreview.isValid) {
      newErrors.quantity = 'Cannot reduce more than current stock';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const updateField = <K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/stock-adjustment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          materialId: formData.materialId,
          adjustmentType: formData.adjustmentType,
          quantity: parseFloat(formData.quantity),
          reason: formData.reason,
          adjustmentDate: formData.adjustmentDate || undefined,
          remarks: formData.remarks || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to adjust stock');
      }

      toast({
        title: 'Stock adjusted successfully',
        description: `${selectedMaterial?.name} stock has been ${
          formData.adjustmentType === 'add' ? 'increased' : 'reduced'
        } by ${formData.quantity} ${selectedMaterial?.unit}.`,
      });

      router.push('/inventory');
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to adjust stock. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-spin" />
            <p className="text-muted-foreground">Loading materials...</p>
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
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">Error loading materials</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="hidden md:flex">
            <Link href="/inventory">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="page-title">Stock Adjustment</h1>
            <p className="text-muted-foreground text-sm mt-1 hidden md:block">
              Record non-production stock changes
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="grid gap-6 md:grid-cols-5">
          {/* Main Form */}
          <div className="md:col-span-3">
            <div className="industrial-card p-6 animate-fade-in">
              <h2 className="section-title">Adjustment Details</h2>

              <div className="form-section">
                {/* Raw Material Selection */}
                <div className="space-y-2">
                  <Label>Raw Material *</Label>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between",
                          errors.materialId && "border-destructive"
                        )}
                      >
                        {formData.materialId
                          ? rawMaterials.find(m => m.id === formData.materialId)?.name
                          : "Select raw material"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search raw material..." />
                        <CommandEmpty>No material found.</CommandEmpty>

                        <CommandGroup>
                          {rawMaterials
                            .filter(m => m.status === "active")
                            .map(material => (
                              <CommandItem
                                key={material.id}
                                value={material.name}
                                onSelect={() => {
                                  updateField("materialId", material.id)
                                }}
                              >
                                <div className="flex justify-between w-full">
                                  <span>{material.name}</span>
                                  <span className="text-muted-foreground text-sm">
                                    ({formatQuantity(material.availableStock, material.unit)})
                                  </span>
                                </div>

                                {formData.materialId === material.id && (
                                  <Check className="ml-auto h-4 w-4" />
                                )}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {errors.materialId && (
                    <p className="text-xs text-destructive">{errors.materialId}</p>
                  )}
                </div>


                {/* Current Stock Display */}
                {selectedMaterial && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current Stock</span>
                      <span className="text-lg font-bold text-foreground">
                        {formatQuantity(selectedMaterial.availableStock, selectedMaterial.unit)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">Cost per Unit</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(selectedMaterial.costPerUnit)} / {selectedMaterial.unit}
                      </span>
                    </div>
                  </div>
                )}

                {/* Adjustment Type */}
                <div className="space-y-2">
                  <Label>Adjustment Type *</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updateField('adjustmentType', 'add')}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all',
                        formData.adjustmentType === 'add'
                          ? 'border-success bg-success/10 text-success'
                          : 'border-border hover:border-success/50'
                      )}
                    >
                      <ArrowUp className="h-5 w-5" />
                      <span className="font-medium">Add Stock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('adjustmentType', 'reduce')}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all',
                        formData.adjustmentType === 'reduce'
                          ? 'border-destructive bg-destructive/10 text-destructive'
                          : 'border-border hover:border-destructive/50'
                      )}
                    >
                      <ArrowDown className="h-5 w-5" />
                      <span className="font-medium">Reduce Stock</span>
                    </button>
                  </div>
                </div>

                {/* Quantity & Reason */}
                <div className="form-row">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <div className="relative">
                      <Input
                        id="quantity"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.quantity}
                        onChange={(e) => updateField('quantity', e.target.value)}
                        placeholder="0"
                        className={`pr-12 ${errors.quantity ? 'border-destructive' : ''}`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        {selectedMaterial?.unit || 'kg'}
                      </span>
                    </div>
                    {errors.quantity && (
                      <p className="text-xs text-destructive">{errors.quantity}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Reason *</Label>
                    <Select
                      value={formData.reason}
                      onValueChange={(value: ReasonType) => updateField('reason', value)}
                    >
                      <SelectTrigger className={errors.reason ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {formData.adjustmentType === 'add' ? (
                          <>
                            <SelectItem value="purchase">Purchase Received</SelectItem>
                            <SelectItem value="correction">Stock Correction</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="wastage">Wastage</SelectItem>
                            <SelectItem value="damage">Damage</SelectItem>
                            <SelectItem value="correction">Stock Correction</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    {errors.reason && (
                      <p className="text-xs text-destructive">{errors.reason}</p>
                    )}
                  </div>
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="date">Adjustment Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.adjustmentDate}
                    onChange={(e) => updateField('adjustmentDate', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {/* Remarks */}
                <div className="space-y-2">
                  <Label htmlFor="remarks">Remarks (Optional)</Label>
                  <Textarea
                    id="remarks"
                    value={formData.remarks}
                    onChange={(e) => updateField('remarks', e.target.value)}
                    placeholder="Add reference number, batch ID, or notes..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="md:col-span-2">
            <div className="industrial-card p-6 animate-fade-in md:sticky md:top-6">
              <h2 className="section-title">Preview</h2>

              {adjustmentPreview ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Current Stock</span>
                      <span className="font-medium">
                        {formatQuantity(adjustmentPreview.currentStock, selectedMaterial!.unit)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {formData.adjustmentType === 'add' ? 'Adding' : 'Reducing'}
                      </span>
                      <span className={cn(
                        'font-medium',
                        formData.adjustmentType === 'add' ? 'text-success' : 'text-destructive'
                      )}>
                        {formData.adjustmentType === 'add' ? '+' : '-'}
                        {formatQuantity(adjustmentPreview.quantity, selectedMaterial!.unit)}
                      </span>
                    </div>

                    <div className="border-t border-border pt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Stock After Adjustment</span>
                        <span className={cn(
                          'text-xl font-bold',
                          adjustmentPreview.isValid ? 'text-foreground' : 'text-destructive'
                        )}>
                          {formatQuantity(adjustmentPreview.newStock, selectedMaterial!.unit)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!adjustmentPreview.isValid && (
                    <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive">
                        Cannot reduce stock below zero. Maximum reduction: {formatQuantity(adjustmentPreview.currentStock, selectedMaterial!.unit)}
                      </p>
                    </div>
                  )}

                  {adjustmentPreview.isValid && (
                    <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                      <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        This adjustment is irreversible. Please verify the details before confirming.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Select a material and enter quantity to see preview</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse gap-3 mt-6 md:flex-row md:justify-end max-w-4xl">
          <Button type="button" variant="outline" asChild className="md:w-auto">
            <Link href="/inventory">Cancel</Link>
          </Button>
          <Button
            type="submit"
            className="md:w-auto"
            disabled={!adjustmentPreview?.isValid || isSubmitting}
          >
            <Check className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Processing...' : 'Confirm Adjustment'}
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}
