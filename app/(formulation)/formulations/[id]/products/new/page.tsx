'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, Package, Loader2, Plus, Trash2, Tag,
  AlertTriangle, CheckCircle2, XCircle, ChevronsUpDown, Check,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/libs/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Formulation {
  id: string;
  name: string;
  baseQuantity: number;
  baseUnit: 'kg' | 'gm';
  status: 'active' | 'inactive';
}

interface InventoryLabel {
  id: string;
  name: string;
  availableStock: number;
  minimumStock: number;
  status: 'active' | 'inactive';
}

interface LabelEntry {
  id: string;
  type: string;           // label name (matched to inventory)
  quantity: number;       // qty per courier box
  stockStatus: 'ok' | 'low' | 'out' | 'unknown'; // inventory status
  availableStock: number;
}

interface NewProduct {
  name: string;
  quantity: number;
  unit: 'kg' | 'gm';
  labels: LabelEntry[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CreateProductPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const formulationId = params.id as string;

  const [formulation, setFormulation] = useState<Formulation | null>(null);
  const [inventoryLabels, setInventoryLabels] = useState<InventoryLabel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openPopover, setOpenPopover] = useState<string | null>(null); // tracks which label row's popover is open

  const [formData, setFormData] = useState<NewProduct>({
    name: '',
    quantity: 0,
    unit: 'kg',
    labels: [],
  });

  // ─── Fetch formulation + label inventory ──────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [formulationRes, labelsRes] = await Promise.all([
          fetch(`/api/formulations/${formulationId}`),
          fetch('/api/labels'),
        ]);

        if (!formulationRes.ok) throw new Error('Failed to fetch formulation');
        const formulationData = await formulationRes.json();
        setFormulation(formulationData);

        if (labelsRes.ok) {
          const labelsData = await labelsRes.json();
          setInventoryLabels(labelsData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load data. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (formulationId) fetchData();
  }, [formulationId, toast]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getStockStatus = (label: InventoryLabel): 'ok' | 'low' | 'out' => {
    if (label.availableStock === 0) return 'out';
    if (label.availableStock <= label.minimumStock) return 'low';
    return 'ok';
  };

  const checkLabelStock = (labelName: string): {
    status: 'ok' | 'low' | 'out' | 'unknown';
    availableStock: number;
  } => {
    const found = inventoryLabels.find(
      (l) => l.name.toLowerCase() === labelName.toLowerCase().trim()
    );
    if (!found) return { status: 'unknown', availableStock: 0 };
    return { status: getStockStatus(found), availableStock: found.availableStock };
  };

  // ─── Label handlers ───────────────────────────────────────────────────────

  const addLabel = () => {
    setFormData((prev) => ({
      ...prev,
      labels: [
        ...prev.labels,
        {
          id: `label-${Date.now()}`,
          type: '',
          quantity: 0,
          stockStatus: 'unknown',
          availableStock: 0,
        },
      ],
    }));
  };

  const removeLabel = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      labels: prev.labels.filter((label) => label.id !== id),
    }));
  };

  const selectLabelType = (id: string, labelName: string) => {
    const { status, availableStock } = checkLabelStock(labelName);
    setFormData((prev) => ({
      ...prev,
      labels: prev.labels.map((label) =>
        label.id === id
          ? { ...label, type: labelName, stockStatus: status, availableStock }
          : label
      ),
    }));
    setOpenPopover(null);
  };

  const updateLabelQuantity = (id: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      labels: prev.labels.map((label) =>
        label.id === id ? { ...label, quantity: Number(value) } : label
      ),
    }));
  };

  const handleInputChange = (field: keyof NewProduct, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || formData.quantity <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields with valid values.',
        variant: 'destructive',
      });
      return;
    }

    const invalidLabels = formData.labels.filter(
      (label) => !label.type.trim() || label.quantity <= 0
    );
    if (invalidLabels.length > 0) {
      toast({
        title: 'Validation Error',
        description: 'All labels must have a type and qty per courier box greater than 0.',
        variant: 'destructive',
      });
      return;
    }

    // Block if any label is out of stock
    const outOfStock = formData.labels.filter((l) => l.stockStatus === 'out');
    if (outOfStock.length > 0) {
      toast({
        title: 'Out of Stock Labels',
        description: `"${outOfStock.map((l) => l.type).join(', ')}" ${outOfStock.length > 1 ? 'are' : 'is'} out of stock. Please purchase stock before proceeding.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);

      const response = await fetch(`/api/formulations/${formulationId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          quantity: formData.quantity,
          unit: formData.unit,
          labels: formData.labels.map((l) => ({ type: l.type, quantity: l.quantity })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create product');
      }

      toast({ title: 'Success', description: 'Product created successfully.' });
      router.push(`/formulations/${formulationId}/products`);
    } catch (error) {
      console.error('Error creating product:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create product.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Loading / not found ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!formulation) {
    return (
      <AppLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Formulation not found</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/formulations">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Formulations
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const hasOutOfStockLabels = formData.labels.some((l) => l.stockStatus === 'out');

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl mx-auto">

        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/formulations/${formulationId}/products`}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="page-title">Create Product</h1>
              <p className="text-muted-foreground mt-1">
                New product from: {formulation.name}
              </p>
            </div>
          </div>
        </div>

        {/* Formulation Info */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Formulation</p>
                <p className="font-semibold">{formulation.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Base Quantity</p>
                <p className="font-semibold">
                  {formulation.baseQuantity} {formulation.baseUnit}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter product name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) =>
                      handleInputChange('quantity', parseFloat(e.target.value) || 0)
                    }
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="unit">Unit *</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value: 'kg' | 'gm') => handleInputChange('unit', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kilograms (kg)</SelectItem>
                      <SelectItem value="gm">Grams (gm)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Labels Section */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Tag className="h-5 w-5" />
                  Labels
                  <span className="text-sm font-normal text-muted-foreground">(Optional)</span>
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLabel}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Label
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Select labels from inventory and define how many fit per courier box.
                Out-of-stock labels must be restocked before creating the product.
              </p>
            </CardHeader>

            <CardContent>
              {/* Out of stock warning banner */}
              {hasOutOfStockLabels && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 mb-4">
                  <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive text-sm">
                      Some labels are out of stock
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please go to{' '}
                      <Link
                        href="/labels/inventory"
                        className="underline text-primary hover:text-primary/80"
                      >
                        Labels Inventory
                      </Link>{' '}
                      and add stock before creating this product.
                    </p>
                  </div>
                </div>
              )}

              {formData.labels.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Tag className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>No labels added yet</p>
                  <p className="text-sm">
                    Click "Add Label" to define packaging label types
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.labels.map((label, index) => (
                    <div
                      key={label.id}
                      className={cn(
                        'p-4 border rounded-lg bg-muted/30 space-y-3',
                        label.stockStatus === 'out' && 'border-destructive/50 bg-destructive/5',
                        label.stockStatus === 'low' && 'border-amber-400/50 bg-amber-50/50 dark:bg-amber-900/10',
                      )}
                    >
                      <div className="flex items-end gap-3">

                        {/* Label type — searchable combobox from inventory */}
                        <div className="flex-1 space-y-2">
                          <Label htmlFor={`label-type-${label.id}`}>
                            Label Type {index + 1}
                          </Label>
                          <Popover
                            open={openPopover === label.id}
                            onOpenChange={(open) =>
                              setOpenPopover(open ? label.id : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  'w-full justify-between font-normal',
                                  !label.type && 'text-muted-foreground',
                                  label.stockStatus === 'out' && 'border-destructive',
                                )}
                              >
                                {label.type || 'Select label from inventory...'}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                              <Command>
                                <CommandInput placeholder="Search labels..." />
                                <CommandEmpty>
                                  No label found.{' '}
                                  <Link
                                    href="/labels/add-label"
                                    className="underline text-primary"
                                  >
                                    Add to inventory
                                  </Link>
                                </CommandEmpty>
                                <CommandGroup>
                                  {inventoryLabels
                                    .filter((l) => l.status === 'active')
                                    .map((invLabel) => {
                                      const status = getStockStatus(invLabel);
                                      return (
                                        <CommandItem
                                          key={invLabel.id}
                                          value={invLabel.name}
                                          onSelect={() =>
                                            selectLabelType(label.id, invLabel.name)
                                          }
                                        >
                                          <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                                              <span>{invLabel.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 ml-2">
                                              {status === 'out' && (
                                                <span className="text-xs text-destructive font-medium">
                                                  Out of stock
                                                </span>
                                              )}
                                              {status === 'low' && (
                                                <span className="text-xs text-amber-600 font-medium">
                                                  Low ({invLabel.availableStock})
                                                </span>
                                              )}
                                              {status === 'ok' && (
                                                <span className="text-xs text-muted-foreground">
                                                  {invLabel.availableStock.toLocaleString('en-IN')} pcs
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          {label.type === invLabel.name && (
                                            <Check className="ml-2 h-4 w-4 shrink-0" />
                                          )}
                                        </CommandItem>
                                      );
                                    })}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Qty per courier box */}
                        <div className="w-48 space-y-2">
                          <Label htmlFor={`label-quantity-${label.id}`}>
                            Qty per Courier Box
                          </Label>
                          <div className="relative">
                            <Input
                              id={`label-quantity-${label.id}`}
                              type="number"
                              min="1"
                              value={label.quantity || ''}
                              onChange={(e) => updateLabelQuantity(label.id, e.target.value)}
                              placeholder="e.g., 10"
                              className="pr-14"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              pcs/box
                            </span>
                          </div>
                          {label.quantity > 0 && label.type && (
                            <p className="text-xs text-muted-foreground">
                              {label.quantity} {label.type} fit in 1 box
                            </p>
                          )}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLabel(label.id)}
                          className="text-destructive hover:text-destructive mb-0.5"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Stock status indicator */}
                      {label.type && (
                        <div className="flex items-center gap-2 text-xs">
                          {label.stockStatus === 'ok' && (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              <span className="text-success">
                                In stock — {label.availableStock.toLocaleString('en-IN')} pcs available
                              </span>
                            </>
                          )}
                          {label.stockStatus === 'low' && (
                            <>
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                              <span className="text-amber-600">
                                Low stock — only {label.availableStock.toLocaleString('en-IN')} pcs left.
                                Consider restocking soon.
                              </span>
                            </>
                          )}
                          {label.stockStatus === 'out' && (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-destructive" />
                              <span className="text-destructive font-medium">
                                Out of stock — please{' '}
                                <Link
                                  href={`/labels/stock-adjustment/new`}
                                  className="underline hover:text-destructive/80"
                                >
                                  add stock
                                </Link>{' '}
                                before proceeding.
                              </span>
                            </>
                          )}
                          {label.stockStatus === 'unknown' && (
                            <>
                              <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                Label not found in inventory.{' '}
                                <Link
                                  href="/labels/add-label"
                                  className="underline hover:text-foreground"
                                >
                                  Add it first
                                </Link>
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between gap-3 mt-6">
            <Button variant="outline" asChild>
              <Link href={`/formulations/${formulationId}/products`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cancel
              </Link>
            </Button>
            <Button
              type="submit"
              disabled={isSaving || hasOutOfStockLabels}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Create Product
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}