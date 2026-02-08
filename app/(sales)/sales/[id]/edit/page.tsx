'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

export default function SalesEdit() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAdmin } = useAuth();

  const [sale, setSale] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Check admin access
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      toast({
        title: 'Access Denied',
        description: 'Only administrators can edit sales records',
        variant: 'destructive',
      });
      router.push('/sales');
      return;
    }
  }, [user, authLoading, isAdmin, router, toast]);

  useEffect(() => {
    if (!id || authLoading || !user || !isAdmin) return;

    // Validate ID format
    if (typeof id !== 'string' || id.trim() === '') {
      setError('Invalid sales record ID');
      setLoading(false);
      return;
    }

    const fetchSale = async () => {
      try {
        const response = await fetch(`/api/sales/records/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            router.push('/sales');
            return;
          }
          throw new Error('Failed to fetch sales record');
        }

        const data = await response.json();
        setSale(data);
        setFieldErrors({}); // Clear any existing field errors when data loads
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: 'Failed to load sales record',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSale();
  }, [id, authLoading, user, isAdmin, router, toast]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const validateField = (field: string, value: any): string | null => {
    switch (field) {
      case 'quantitySold':
        const quantity = Number(value);
        if (!value || value === '') return 'Quantity is required';
        if (isNaN(quantity) || quantity <= 0) return 'Quantity must be a positive number';
        if (!Number.isInteger(quantity)) return 'Quantity must be a whole number';
        return null;
      
      case 'sellingPricePerUnit':
        const price = Number(value);
        if (!value || value === '') return 'Selling price is required';
        if (isNaN(price) || price < 0) return 'Selling price must be 0 or positive';
        return null;
      
      case 'discount':
        const discount = Number(value);
        if (value !== '' && (isNaN(discount) || discount < 0 || discount > 100)) {
          return 'Discount must be between 0 and 100';
        }
        return null;
      
      default:
        return null;
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // Update sale data
    setSale((prev: any) => {
      if (!prev) return prev;
      
      const updatedSale = { ...prev, [field]: value };
      
      // Recalculate totals and profit when quantity, price, or discount changes
      if (field === 'quantitySold' || field === 'sellingPricePerUnit' || field === 'discount') {
        const quantity = Number(updatedSale.quantitySold) || 0;
        const price = Number(updatedSale.sellingPricePerUnit) || 0;
        const discount = Number(updatedSale.discount) || 0;
        const productionCostPerUnit = Number(updatedSale.productionCostPerUnit) || 0;
        
        // Check if this is a free product
        const isFree = price === 0;
        
        const totalAmountBeforeDiscount = quantity * price;
        const discountAmount = isFree ? 0 : totalAmountBeforeDiscount * (discount / 100);
        updatedSale.totalAmount = totalAmountBeforeDiscount - discountAmount;
        updatedSale.productionCostTotal = quantity * productionCostPerUnit;
        updatedSale.profit = isFree ? 0 : updatedSale.totalAmount - updatedSale.productionCostTotal;
      }
      
      return updatedSale;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sale) return;

    // Validate all fields before submission
    const errors: Record<string, string> = {};
    const quantityError = validateField('quantitySold', sale.quantitySold);
    const priceError = validateField('sellingPricePerUnit', sale.sellingPricePerUnit);
    const discountError = validateField('discount', sale.discount);
    
    if (quantityError) errors.quantitySold = quantityError;
    if (priceError) errors.sellingPricePerUnit = priceError;
    if (discountError) errors.discount = discountError;
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors below',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/sales/records/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantitySold: sale.quantitySold,
          sellingPrice: sale.sellingPricePerUnit,
          discount: (sale.sellingPricePerUnit === 0) ? 0 : (sale.discount || 0),
          remarks: sale.remarks,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update sales record');
      }

      toast({
        title: 'Success',
        description: 'Sales record updated successfully',
      });

      router.push('/sales');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  if (error || !sale) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">
            {error || 'Sales record not found or failed to load'}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!user || !isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">Access denied. Administrator privileges required.</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* HEADER */}
        <div className="page-header">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/sales">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="page-title">Edit Sale</h1>
          </div>
        </div>

        {/* ERROR ALERT */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="text-destructive font-medium">Error:</div>
                <div className="text-sm">{error}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SALE DETAILS */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Input value={sale.productName} disabled />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity Sold</Label>
                <Input
                  type="number"
                  value={sale.quantitySold}
                  onChange={(e) => handleFieldChange('quantitySold', e.target.value)}
                  className={fieldErrors.quantitySold ? 'border-destructive' : ''}
                />
                {fieldErrors.quantitySold && (
                  <div className="text-destructive text-sm">{fieldErrors.quantitySold}</div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Selling Price / Unit</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={sale.sellingPricePerUnit}
                    onChange={(e) => handleFieldChange('sellingPricePerUnit', e.target.value)}
                    className={fieldErrors.sellingPricePerUnit ? 'border-destructive' : ''}
                  />
                  {sale.sellingPricePerUnit === 0 && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      FREE
                    </Badge>
                  )}
                </div>
                {fieldErrors.sellingPricePerUnit && (
                  <div className="text-destructive text-sm">{fieldErrors.sellingPricePerUnit}</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount (%)</Label>
                <Input
                  type="number"
                  value={sale.discount || ''}
                  onChange={(e) => handleFieldChange('discount', e.target.value)}
                  placeholder="0"
                  min="0"
                  max="100"
                  step="0.1"
                  className={fieldErrors.discount ? 'border-destructive' : ''}
                />
                {fieldErrors.discount && (
                  <div className="text-destructive text-sm">{fieldErrors.discount}</div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Production Cost / Unit</Label>
                <Input
                  type="number"
                  value={sale.productionCostPerUnit || 0}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

              <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Production Cost</Label>
                <Input
                  value={formatCurrency(sale.productionCostTotal || 0)}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label>Profit</Label>
                <div className="flex gap-2">
                  <Input
                    value={sale.sellingPricePerUnit === 0 ? 'N/A' : formatCurrency(sale.profit || 0)}
                    disabled
                    className={sale.sellingPricePerUnit === 0 ? "bg-muted" : (sale.profit >= 0 ? "bg-muted" : "bg-muted text-destructive")}
                  />
                  {sale.sellingPricePerUnit === 0 && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      FREE
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
                <Label>Total Amount</Label>
                <div className="flex gap-2">
                  <Input
                    value={sale.totalAmount === 0 ? 'FREE' : formatCurrency(sale.totalAmount || 0)}
                    disabled
                    className="bg-muted"
                  />
                  {sale.totalAmount === 0 && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      FREE
                    </Badge>
                  )}
                </div>
              </div>

            <div className="space-y-2">
              <Label>Remarks</Label>
              <Input
                value={sale.remarks || ''}
                onChange={(e) => handleFieldChange('remarks', e.target.value)}
                placeholder="Optional notes about this sale"
              />
            </div>
          </CardContent>
        </Card>

        {/* ACTIONS */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href="/sales">Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}
