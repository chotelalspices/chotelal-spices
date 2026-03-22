'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Package2, Loader2 } from 'lucide-react';
import Link from 'next/link';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface FormData {
  date: string;
  companyName: string;
  productName: string;
  code: string;
  price: string;
  notes: string;
}

interface ExtendedInventoryFormProps {
  mode: 'add' | 'edit';
  itemId?: string;
}

export default function ExtendedInventoryForm({ mode, itemId }: ExtendedInventoryFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || false;

  const [formData, setFormData] = useState<FormData>({
    date: new Date().toISOString().split('T')[0],
    companyName: '',
    productName: '',
    code: '',
    price: '',
    notes: '',
  });
  const [isLoading, setIsLoading] = useState(mode === 'edit');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing data in edit mode
  useEffect(() => {
    if (mode !== 'edit' || !itemId) return;
    const fetch_ = async () => {
      try {
        const res = await fetch('/api/extended-inventory');
        if (!res.ok) throw new Error();
        const items = await res.json();
        const item = items.find((i: any) => i.id === itemId);
        if (!item) { toast({ title: 'Not found', variant: 'destructive' }); router.push('/research/extended-inventory'); return; }
        setFormData({
          date: item.date,
          companyName: item.companyName || '',
          productName: item.productName,
          code: item.code || '',
          price: item.price?.toString() || '',
          notes: item.notes || '',
        });
      } catch {
        toast({ title: 'Error', description: 'Failed to load item', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    fetch_();
  }, [mode, itemId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.companyName.trim() || !formData.productName.trim()) {
      toast({ title: 'Validation error', description: 'Date, company name and product name are required', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const url = mode === 'edit' ? `/api/extended-inventory/${itemId}` : '/api/extended-inventory';
      const method = mode === 'edit' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date,
          companyName: formData.companyName.trim(),
          productName: formData.productName.trim(),
          code: formData.code.trim() || null,
          price: parseFloat(formData.price) || 0,
          notes: formData.notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }

      toast({
        title: mode === 'edit' ? 'Updated' : 'Added',
        description: `${formData.productName} ${mode === 'edit' ? 'updated' : 'added'} successfully`,
      });
      router.push('/research/extended-inventory');
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/research/extended-inventory">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package2 className="h-6 w-6 text-primary" />
              {mode === 'edit' ? 'Edit Item' : 'Add Extended Inventory Item'}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {mode === 'edit' ? 'Update item details' : 'Add a new external product or sample'}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Item Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              {/* Company Name — admin only */}
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  placeholder="e.g. ABC Spices Ltd"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Product Name */}
              <div className="space-y-2">
                <Label htmlFor="productName">Product Name *</Label>
                <Input
                  id="productName"
                  placeholder="e.g. Turmeric Powder Premium"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  required
                />
              </div>

              {/* Code */}
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  placeholder="e.g. TUR-001"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="price">Price (₹)</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Any additional notes about this item..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href="/research/extended-inventory">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {mode === 'edit' ? 'Save Changes' : 'Add Item'}
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}