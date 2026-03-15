'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Package, Loader2, Plus, Trash2 } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Formulation {
  id: string;
  name: string;
  baseQuantity: number;
  baseUnit: 'kg' | 'gm';
  status: 'active' | 'inactive';
}

interface LabelEntry {
  id: string;
  type: string;
  quantity: number;
  semiPackageable: boolean;
}

interface ProductData {
  id: string;
  name: string;
  quantity: number;
  unit: 'kg' | 'gm';
  formulationId: string;
  labels: Array<{
    type: string;
    quantity: number;
    semiPackageable: boolean;
  }>;
}

interface EditProductForm {
  name: string;
  quantity: number;
  unit: 'kg' | 'gm';
  labels: LabelEntry[];
}

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const formulationId = params.id as string;
  const productId = params.productId as string;

  const [formulation, setFormulation] = useState<Formulation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<EditProductForm>({
    name: '',
    quantity: 0,
    unit: 'kg',
    labels: [],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch formulation
        const formulationResponse = await fetch(`/api/formulations/${formulationId}`);
        if (!formulationResponse.ok) {
          throw new Error('Failed to fetch formulation');
        }
        const formulationData = await formulationResponse.json();
        setFormulation(formulationData);

        // Fetch product
        const productResponse = await fetch(`/api/formulations/${formulationId}/products/${productId}`);
        if (!productResponse.ok) {
          throw new Error('Failed to fetch product');
        }
        const productData: ProductData = await productResponse.json();

        // Populate form with existing data
        setFormData({
          name: productData.name,
          quantity: productData.quantity,
          unit: productData.unit,
          labels: productData.labels?.map((label, index) => ({
            id: `label-${index}`,
            type: label.type,
            quantity: label.quantity,
            semiPackageable: label.semiPackageable || false,
          })) || [],
        });
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load data. Please try again.',
          variant: 'destructive',
        });
        router.push(`/formulations/${formulationId}/products`);
      } finally {
        setIsLoading(false);
      }
    };

    if (formulationId && productId) {
      fetchData();
    }
  }, [formulationId, productId, router, toast]);

  const handleInputChange = (
    field: keyof EditProductForm,
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // ── Label management functions ──
  const addLabel = () => {
    const newLabel: LabelEntry = {
      id: `label-${Date.now()}`,
      type: '',
      quantity: 0,
      semiPackageable: false,
    };
    setFormData((prev) => ({
      ...prev,
      labels: [...prev.labels, newLabel],
    }));
  };

  const removeLabel = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      labels: prev.labels.filter((label) => label.id !== id),
    }));
  };

  const updateLabel = (id: string, field: 'type' | 'quantity' | 'semiPackageable', value: string | number | boolean) => {
    setFormData((prev) => ({
      ...prev,
      labels: prev.labels.map((label) =>
        label.id === id
          ? { ...label, [field]: field === 'quantity' ? Number(value) : value }
          : label
      ),
    }));
  };

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

    // Validate labels
    const invalidLabels = formData.labels.filter(
      (label) => !label.type.trim() || label.quantity <= 0
    );
    if (invalidLabels.length > 0) {
      toast({
        title: 'Validation Error',
        description: 'All labels must have a type and quantity greater than 0.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);

      const response = await fetch(`/api/formulations/${formulationId}/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update product');
      }

      toast({
        title: 'Success',
        description: 'Product updated successfully.',
      });

      router.push(`/formulations/${formulationId}/products`);
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update product. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading product...</p>
          </div>
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
              <h1 className="page-title">Edit Product</h1>
              <p className="text-muted-foreground mt-1">
                From: {formulation.name}
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
                    onChange={(e) =>
                      handleInputChange('name', e.target.value)
                    }
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
                      handleInputChange(
                        'quantity',
                        parseFloat(e.target.value) || 0
                      )
                    }
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="unit">Unit *</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value: 'kg' | 'gm') =>
                      handleInputChange('unit', value)
                    }
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
                <CardTitle className="text-lg">Labels (Optional)</CardTitle>
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
                Track different packaging types and quantities
              </p>
            </CardHeader>

          <CardContent>
            {formData.labels.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No labels added yet</p>
                <p className="text-sm">Click "Add Label" to start tracking packaging</p>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.labels.map((label, index) => (
                  <div
                    key={label.id}
                    className="flex items-end gap-3 p-4 border rounded-lg bg-muted/30"
                  >
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={`label-type-${label.id}`}>
                        Label Type {index + 1}
                      </Label>
                      <Input
                        id={`label-type-${label.id}`}
                        value={label.type}
                        onChange={(e) =>
                          updateLabel(label.id, 'type', e.target.value)
                        }
                        placeholder="e.g., Box, Packet, Container"
                      />
                    </div>

                    <div className="w-32 space-y-2">
                      <Label htmlFor={`label-quantity-${label.id}`}>
                        Quantity
                      </Label>
                      <Input
                        id={`label-quantity-${label.id}`}
                        type="number"
                        min="1"
                        value={label.quantity}
                        onChange={(e) =>
                          updateLabel(label.id, 'quantity', e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>

                    <div className="w-32 space-y-2">
                      <Label htmlFor={`label-semi-packageable-${label.id}`}>
                        Semi-packageable
                      </Label>
                      <Checkbox
                        id={`label-semi-packageable-${label.id}`}
                        checked={label.semiPackageable}
                        onCheckedChange={(checked) =>
                          updateLabel(label.id, 'semiPackageable', checked)
                        }
                        className="mt-4 ml-[50%]"
                      />
                    </div>
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
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}