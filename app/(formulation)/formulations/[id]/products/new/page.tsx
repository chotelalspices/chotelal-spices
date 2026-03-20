'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, Package, Loader2, Plus, Trash2, Tag, Check, ChevronsUpDown,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem,
} from '@/components/ui/command';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
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
  status: string;
}

interface LabelEntry {
  id: string;
  type: string;      // label name from inventory
  quantity: number;  // qty per courier box
  semiPackageable: boolean;
  comboOpen: boolean;
}

interface NewProduct {
  name: string;
  quantity: string;  // ← string so user can freely edit (no stuck "0")
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

  const [formData, setFormData] = useState<NewProduct>({
    name: '',
    quantity: '',   // ← empty string so placeholder shows and user can type freely
    unit: 'kg',
    labels: [],
  });

  // ─── Fetch formulation + inventory labels ─────────────────────────────────

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
          const labelsData: InventoryLabel[] = await labelsRes.json();
          // Only show active labels
          setInventoryLabels(labelsData.filter((l) => l.status === 'active'));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load formulation. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (formulationId) fetchData();
  }, [formulationId, toast]);

  // ─── Label handlers ───────────────────────────────────────────────────────

  const addLabel = () => {
    setFormData((prev) => ({
      ...prev,
      labels: [
        ...prev.labels,
        { id: `label-${Date.now()}`, type: '', quantity: 0, semiPackageable: false, comboOpen: false },
      ],
    }));
  };

  const removeLabel = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      labels: prev.labels.filter((label) => label.id !== id),
    }));
  };

  const updateLabel = (
    id: string,
    field: 'type' | 'quantity' | 'semiPackageable' | 'comboOpen',
    value: string | number | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      labels: prev.labels.map((label) =>
        label.id === id
          ? { ...label, [field]: field === 'quantity' ? Number(value) : value }
          : label
      ),
    }));
  };

  const handleInputChange = (field: keyof Omit<NewProduct, 'labels'>, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedQty = parseFloat(formData.quantity);

    if (!formData.name || !formData.quantity || isNaN(parsedQty) || parsedQty <= 0) {
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
        description: 'All labels must have a type selected and qty per courier box greater than 0.',
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
          quantity: parsedQty,
          unit: formData.unit,
          labels: formData.labels.map((l) => ({
            type: l.type,
            quantity: l.quantity,
            semiPackageable: l.semiPackageable,
          })),
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

                {/* Product Name */}
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

                {/* Quantity — string-based so backspace works naturally */}
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>

                {/* Unit */}
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
              </p>
            </CardHeader>

            <CardContent>
              {formData.labels.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Tag className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>No labels added yet</p>
                  <p className="text-sm">Click "Add Label" to define packaging label types</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.labels.map((label, index) => (
                    <div
                      key={label.id}
                      className="flex items-end gap-3 p-4 border rounded-lg bg-muted/30"
                    >
                      {/* Label type — searchable dropdown from inventory */}
                      <div className="flex-1 space-y-2">
                        <Label htmlFor={`label-type-${label.id}`}>
                          Label Type {index + 1}
                        </Label>
                        <Popover
                          open={label.comboOpen}
                          onOpenChange={(open) => updateLabel(label.id, 'comboOpen', open)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                'w-full justify-between font-normal',
                                !label.type && 'text-muted-foreground'
                              )}
                            >
                              {label.type || 'Select label from inventory'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search labels..." />
                              <CommandEmpty>
                                {inventoryLabels.length === 0
                                  ? 'No active labels in inventory.'
                                  : 'No label found.'}
                              </CommandEmpty>
                              <CommandGroup>
                                {inventoryLabels.map((invLabel) => {
                                  // Prevent selecting the same label twice
                                  const alreadyUsed = formData.labels.some(
                                    (l) => l.type === invLabel.name && l.id !== label.id
                                  );
                                  return (
                                    <CommandItem
                                      key={invLabel.id}
                                      value={invLabel.name}
                                      disabled={alreadyUsed}
                                      onSelect={() => {
                                        updateLabel(label.id, 'type', invLabel.name);
                                        updateLabel(label.id, 'comboOpen', false);
                                      }}
                                      className={cn(alreadyUsed && 'opacity-40 cursor-not-allowed')}
                                    >
                                      <div className="flex justify-between w-full">
                                        <span>{invLabel.name}</span>
                                        <span className="text-xs text-muted-foreground ml-2">
                                          {invLabel.availableStock.toLocaleString('en-IN')} in stock
                                        </span>
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
                            onChange={(e) =>
                              updateLabel(label.id, 'quantity', Number(e.target.value))
                            }
                            placeholder="e.g., 10"
                            className="pr-14"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            pcs/box
                          </span>
                        </div>
                      </div>

                      {/* Semi-packageable checkbox */}
                      <div className="w-36 space-y-2">
                        <Label htmlFor={`label-semi-${label.id}`}>
                          Semi-packageable
                        </Label>
                        <div className="flex items-center justify-center h-10">
                          <Checkbox
                            id={`label-semi-${label.id}`}
                            checked={label.semiPackageable}
                            onCheckedChange={(checked) =>
                              updateLabel(label.id, 'semiPackageable', !!checked)
                            }
                          />
                        </div>
                      </div>

                      {/* Remove */}
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
            <Button type="submit" disabled={isSaving} className="gap-2">
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