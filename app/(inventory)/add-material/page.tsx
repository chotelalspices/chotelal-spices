'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, Save } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { rawMaterials, RawMaterial, formatCurrency } from '@/data/sampleData';
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
import { useToast } from '@/hooks/use-toast';
import { getCurrentUser } from '@/data/usersData';

interface FormData {
  name: string;
  unit: 'kg' | 'gm';
  costPerUnit: string;
  openingStock: string;
  minimumStock: string;
  status: 'active' | 'inactive';
  description: string;
}

interface AddEditMaterialProps {
  params: { id?: string };
}

export default function AddEditMaterial({ params }: AddEditMaterialProps) {
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id;
  const isEditing = !!id;

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

  // Load existing material if editing
  useEffect(() => {
    if (isEditing) {
      const material = rawMaterials.find((m) => m.id === id);
      if (material) {
        setFormData({
          name: material.name,
          unit: material.unit,
          costPerUnit: material.costPerUnit.toString(),
          openingStock: material.availableStock.toString(),
          minimumStock: material.minimumStock.toString(),
          status: material.status,
          description: material.description || '',
        });
      }
    }
  }, [id, isEditing]);

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Material name is required';
    }

    if (!formData.costPerUnit || parseFloat(formData.costPerUnit) <= 0) {
      newErrors.costPerUnit = 'Valid cost is required';
    }

    if (!isEditing && (!formData.openingStock || parseFloat(formData.openingStock) < 0)) {
      newErrors.openingStock = 'Valid opening stock is required';
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

    // Only handle POST (adding new material) - editing would need a different endpoint
    if (isEditing) {
      toast({
        title: 'Material updated',
        description: `${formData.name} has been updated successfully.`,
      });
      router.push('/inventory');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user for performedById (optional - API will find a user if not provided)
      const currentUser = getCurrentUser();
      
      const requestBody: any = {
        name: formData.name.trim(),
        unit: formData.unit,
        costPerUnit: parseFloat(formData.costPerUnit),
        openingStock: parseFloat(formData.openingStock) || 0,
        minimumStockLevel: parseFloat(formData.minimumStock),
        status: formData.status,
        description: formData.description.trim() || null,
      };

      // Only include performedById if we have a valid current user
      if (currentUser?.id) {
        requestBody.performedById = currentUser.id;
      }

      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create raw material');
      }

      toast({
        title: 'Material added',
        description: `${formData.name} has been added successfully.`,
      });

      router.push('/inventory');
    } catch (error) {
      console.error('Error creating raw material:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add material. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    toast({
      title: 'Material deleted',
      description: `${formData.name} has been removed from inventory.`,
      variant: 'destructive',
    });

    router.push('/');
  };

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

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
            <h1 className="page-title">{isEditing ? 'Edit Raw Material' : 'Add Raw Material'}</h1>
            <p className="text-muted-foreground text-sm mt-1 hidden md:block">
              {isEditing
                ? 'Update material details and settings'
                : 'Create a new raw material entry'}
            </p>
          </div>
        </div>

        {isEditing && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="hidden md:flex">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Raw Material</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{formData.name}"? This action cannot be undone and will remove all associated stock history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
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
                  disabled={isEditing}
                >
                  <SelectTrigger className={isEditing ? 'opacity-60' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="kg">Kilogram (kg)</SelectItem>
                    <SelectItem value="gm">Gram (gm)</SelectItem>
                  </SelectContent>
                </Select>
                {isEditing && (
                  <p className="text-xs text-muted-foreground">Unit cannot be changed after creation</p>
                )}
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
                <Label htmlFor="openingStock">
                  {isEditing ? 'Current Stock' : 'Opening Stock *'}
                </Label>
                <div className="relative">
                  <Input
                    id="openingStock"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.openingStock}
                    onChange={(e) => updateField('openingStock', e.target.value)}
                    placeholder="0"
                    disabled={isEditing}
                    className={`pr-12 ${isEditing ? 'opacity-60' : ''} ${errors.openingStock ? 'border-destructive' : ''}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {formData.unit}
                  </span>
                </div>
                {errors.openingStock && (
                  <p className="text-xs text-destructive">{errors.openingStock}</p>
                )}
                {isEditing && (
                  <p className="text-xs text-muted-foreground">
                    Use Stock Adjustment to modify current stock
                  </p>
                )}
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
                    onCheckedChange={(checked:any) =>
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
            {isSubmitting ? 'Adding...' : isEditing ? 'Save Changes' : 'Add Material'}
          </Button>
        </div>

        {/* Mobile Delete Button */}
        {isEditing && (
          <div className="md:hidden mt-6 pt-6 border-t border-border">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Material
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Raw Material</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{formData.name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </form>
    </AppLayout>
  );
}
