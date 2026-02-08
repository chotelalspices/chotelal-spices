'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface FormData {
  name: string;
  unit: 'kg' | 'gm';
  costPerUnit: string;
  openingStock: string;
  minimumStock: string;
  status: 'active' | 'inactive';
  description: string;
}

export default function EditMaterial() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const id = params?.id as string;

  const [formData, setFormData] = useState<FormData>({
    name: '',
    unit: 'kg',
    costPerUnit: '',
    openingStock: '',
    minimumStock: '',
    status: 'active',
    description: '',
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load existing material data
  useEffect(() => {
    const fetchMaterial = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/inventory/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            toast({
              title: 'Material not found',
              description: 'The material you are trying to edit does not exist.',
              variant: 'destructive',
            });
            router.push('/inventory');
            return;
          }
          throw new Error('Failed to fetch material');
        }

        const material = await response.json();
        
        setFormData({
          name: material.name,
          unit: material.unit,
          costPerUnit: material.costPerUnit.toString(),
          openingStock: material.availableStock.toString(),
          minimumStock: material.minimumStock.toString(),
          status: material.status,
          description: material.description || '',
        });
      } catch (error) {
        console.error('Error fetching material:', error);
        toast({
          title: 'Error',
          description: 'Failed to load material data. Please try again.',
          variant: 'destructive',
        });
        router.push('/inventory');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchMaterial();
    }
  }, [id, router, toast]);

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Material name is required';
    }

    if (!formData.costPerUnit || parseFloat(formData.costPerUnit) <= 0) {
      newErrors.costPerUnit = 'Valid cost is required';
    }

    if (!formData.minimumStock || parseFloat(formData.minimumStock) < 0) {
      newErrors.minimumStock = 'Valid minimum stock is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const requestBody = {
        name: formData.name.trim(),
        costPerUnit: parseFloat(formData.costPerUnit),
        minimumStockLevel: parseFloat(formData.minimumStock),
        status: formData.status,
        description: formData.description.trim() || null,
      };

      const response = await fetch(`/api/inventory/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update raw material');
      }

      toast({
        title: 'Material updated',
        description: `${formData.name} has been updated successfully.`,
      });

      router.push('/inventory');
    } catch (error) {
      console.error('Error updating raw material:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update material. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading material data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="hidden md:flex" asChild>
            <Link href="/inventory">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="page-title">Edit Raw Material</h1>
            <p className="text-muted-foreground text-sm mt-1 hidden md:block">
              Update material details and settings
            </p>
          </div>
        </div>

      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="industrial-card p-6 animate-fade-in">
          <h2 className="section-title">Material Details</h2>

          <div className="form-section">
            {/* Row 1: Name & Unit */}
            <div className="form-row">
              <div className="space-y-2">
                <Label htmlFor="name">Raw Material Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Turmeric Powder"
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value: 'kg' | 'gm') => updateField('unit', value)}
                  disabled={true}
                >
                  <SelectTrigger className="opacity-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="kg">Kilogram (kg)</SelectItem>
                    <SelectItem value="gm">Gram (gm)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Unit cannot be changed after creation</p>
              </div>
            </div>

            {/* Row 2: Cost & Opening Stock */}
            <div className="form-row">
              <div className="space-y-2">
                <Label htmlFor="cost">Cost per Unit (₹) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.costPerUnit}
                    onChange={(e) => updateField('costPerUnit', e.target.value)}
                    placeholder="0.00"
                    className={`pl-7 ${errors.costPerUnit ? 'border-destructive' : ''}`}
                  />
                </div>
                {errors.costPerUnit && (
                  <p className="text-xs text-destructive">{errors.costPerUnit}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="openingStock">Current Stock</Label>
                <div className="relative">
                  <Input
                    id="openingStock"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.openingStock}
                    onChange={(e) => updateField('openingStock', e.target.value)}
                    placeholder="0"
                    disabled={true}
                    className="pr-12 opacity-60"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {formData.unit}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use Stock Adjustment to modify current stock
                </p>
              </div>
            </div>

            {/* Row 3: Minimum Stock & Status */}
            <div className="form-row">
              <div className="space-y-2">
                <Label htmlFor="minimumStock">Minimum Stock Level *</Label>
                <div className="relative">
                  <Input
                    id="minimumStock"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.minimumStock}
                    onChange={(e) => updateField('minimumStock', e.target.value)}
                    placeholder="0"
                    className={`pr-12 ${errors.minimumStock ? 'border-destructive' : ''}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {formData.unit}
                  </span>
                </div>
                {errors.minimumStock && (
                  <p className="text-xs text-destructive">{errors.minimumStock}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Alert threshold for low stock warning
                </p>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {formData.status === 'active' ? 'Active' : 'Inactive'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formData.status === 'active'
                        ? 'Available for production'
                        : 'Not available for use'}
                    </p>
                  </div>
                  <Switch
                    checked={formData.status === 'active'}
                    onCheckedChange={(checked: any) =>
                      updateField('status', checked ? 'active' : 'inactive')
                    }
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Add notes about quality, source, or usage..."
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse gap-3 mt-6 md:flex-row md:justify-end">
          <Button type="button" variant="outline" asChild className="md:w-auto">
            <Link href="/inventory">Cancel</Link>
          </Button>
          <Button type="submit" className="md:w-auto" disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

      </form>
    </AppLayout>
  );
}
