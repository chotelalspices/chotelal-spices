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
import { useToast } from '@/hooks/use-toast';

interface FormData {
  name: string;
  minimumStock: string;
  status: 'active' | 'inactive';
  description: string;
}

export default function EditLabel() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const id = params?.id as string;

  const [formData, setFormData] = useState<FormData>({
    name: '',
    minimumStock: '',
    status: 'active',
    description: '',
  });

  const [currentStock, setCurrentStock] = useState<number>(0);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLabel = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/labels/${id}`);

        if (!response.ok) {
          if (response.status === 404) {
            toast({
              title: 'Label not found',
              description: 'The label you are trying to edit does not exist.',
              variant: 'destructive',
            });
            router.push('/labels/inventory');
            return;
          }
          throw new Error('Failed to fetch label');
        }

        const label = await response.json();

        setCurrentStock(label.availableStock);
        setFormData({
          name: label.name,
          minimumStock: label.minimumStock.toString(),
          status: label.status,
          description: label.description || '',
        });
      } catch (error) {
        console.error('Error fetching label:', error);
        toast({
          title: 'Error',
          description: 'Failed to load label data. Please try again.',
          variant: 'destructive',
        });
        router.push('/labels/inventory');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchLabel();
    }
  }, [id, router, toast]);

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Label name is required';
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
      const response = await fetch(`/api/labels/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          minimumStockLevel: parseFloat(formData.minimumStock),
          status: formData.status,
          description: formData.description.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update label');
      }

      toast({
        title: 'Label updated',
        description: `${formData.name} has been updated successfully.`,
      });

      router.push('/labels/inventory');
    } catch (error) {
      console.error('Error updating label:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update label. Please try again.',
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
            <p className="text-muted-foreground">Loading label data...</p>
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
            <Link href="/labels/inventory">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="page-title">Edit Label</h1>
            <p className="text-muted-foreground text-sm mt-1 hidden md:block">
              Update label details and settings
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="industrial-card p-6 animate-fade-in">
          <h2 className="section-title">Label Details</h2>

          <div className="form-section">
            {/* Row 1: Name */}
            <div className="form-row">
              <div className="space-y-2">
                <Label htmlFor="name">Label Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Turmeric 100g Label"
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name}</p>
                )}
              </div>

              {/* Current Stock — read only */}
              <div className="space-y-2">
                <Label htmlFor="currentStock">Current Stock</Label>
                <div className="relative">
                  <Input
                    id="currentStock"
                    type="number"
                    value={currentStock}
                    disabled
                    className="pr-12 opacity-60"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    pcs
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use Stock Adjustment to modify current stock
                </p>
              </div>
            </div>

            {/* Row 2: Minimum Stock & Status */}
            <div className="form-row">
              <div className="space-y-2">
                <Label htmlFor="minimumStock">Minimum Stock Level *</Label>
                <div className="relative">
                  <Input
                    id="minimumStock"
                    type="number"
                    step="1"
                    min="0"
                    value={formData.minimumStock}
                    onChange={(e) => updateField('minimumStock', e.target.value)}
                    placeholder="0"
                    className={`pr-12 ${errors.minimumStock ? 'border-destructive' : ''}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    pcs
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
                        ? 'Available for packaging'
                        : 'Not available for use'}
                    </p>
                  </div>
                  <Switch
                    checked={formData.status === 'active'}
                    onCheckedChange={(checked: boolean) =>
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
                placeholder="Add notes about size, design version, or product usage..."
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse gap-3 mt-6 md:flex-row md:justify-end">
          <Button type="button" variant="outline" asChild className="md:w-auto">
            <Link href="/labels/inventory">Cancel</Link>
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