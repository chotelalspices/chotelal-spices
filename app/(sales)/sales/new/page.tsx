'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AppLayout } from '@/components/layout/AppLayout';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import {
  ArrowLeft,
  Save,
  Package,
  Calendar,
  IndianRupee,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import { toast } from 'sonner';

import {
  calculateProfit,
  formatCurrency,
  formatQuantity,
} from '@/data/salesData';

interface FinishedProduct {
  id: string;
  name: string;
  formulationId: string;
  formulationName: string;
  batchId?: string | null;
  batchNumber?: string | null;
  availableQuantity: number; // in packets
  unit: 'packets';
  productionCostPerPacket: number;
  containerSize?: number | null;
  containerLabel?: string | null;
  createdAt: string;
  formulation: {
    name: string;
    baseQuantity: number;
    baseUnit: 'kg' | 'gm';
    status: 'active' | 'inactive';
  };
  batches?: any[];
}

export default function SalesEntry() {
  const router = useRouter();

  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantitySold, setQuantitySold] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [remarks, setRemarks] = useState('');

  // Fetch products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/sales/products');
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error('Error fetching products:', error);
        toast.error('Failed to load products. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const selectedProduct = useMemo(() => {
    return selectedProductId
      ? products.find((p) => p.id === selectedProductId)
      : undefined;
  }, [selectedProductId, products]);

  const availableProducts = useMemo(() => {
    return products.filter((fp) => fp.availableQuantity > 0);
  }, [products]);

  const parsedQuantity = parseFloat(quantitySold) || 0;
  const parsedPrice = parseFloat(sellingPrice) || 0;
  const parsedDiscount = parseFloat(discount) || 0;

  // Quantity is in packets (must be whole number)
  const quantityInPackets = Number.isInteger(parsedQuantity) ? parsedQuantity : Math.floor(parsedQuantity);
  
  // Check if this is a free product (price is 0)
  const isFreeProduct = parsedPrice === 0;
  
  const totalAmount = quantityInPackets * parsedPrice;
  const discountAmount = isFreeProduct ? 0 : totalAmount * (parsedDiscount / 100);
  const finalAmount = totalAmount - discountAmount;

  const profit = selectedProduct && !isFreeProduct
    ? calculateProfit(
        quantityInPackets,
        parsedPrice,
        selectedProduct.productionCostPerPacket
      )
    : 0;

  const finalProfit = isFreeProduct ? 0 : profit - discountAmount;

  const isQuantityValid = selectedProduct
    ? quantityInPackets > 0 &&
      quantityInPackets <= selectedProduct.availableQuantity &&
      Number.isInteger(parsedQuantity)
    : false;

  const isPriceValid = parsedPrice >= 0;

  const isFormValid =
    selectedProductId &&
    isQuantityValid &&
    isPriceValid &&
    saleDate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) {
      toast.error('Please fill all required fields correctly');
      return;
    }

    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch('/api/sales/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: selectedProductId,
          quantitySold: quantityInPackets, // packets
          sellingPrice: parsedPrice,
          discount: isFreeProduct ? 0 : parsedDiscount,
          productionCost: selectedProduct ? quantityInPackets * selectedProduct.productionCostPerPacket : null,
          profit: finalProfit,
          saleDate,
          remarks: remarks || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create sales record');
      }

      toast.success('Sale recorded successfully', {
        description: `${quantityInPackets} packet${quantityInPackets !== 1 ? 's' : ''} of ${selectedProduct.name} ${isFreeProduct ? 'given away for free' : `sold for ${formatCurrency(finalAmount)}${parsedDiscount > 0 ? ` (${parsedDiscount}% discount)` : ''}`}`,
      });

      router.push('/sales');
    } catch (error) {
      console.error('Error creating sales record:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to record sale. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/sales')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Sales Entry
            </h1>
            <p className="text-sm text-muted-foreground">
              Record a new sale
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Selection */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Product Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label>Masala / Product Name *</Label>
                      <Select
                        value={selectedProductId}
                        onValueChange={setSelectedProductId}
                        disabled={loading || submitting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          {availableProducts.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              No products available
                            </div>
                          ) : (
                            availableProducts.map((product) => (
                              <SelectItem
                                key={product.id}
                                value={product.id}
                              >
                                {product.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {selectedProduct && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">
                          Available Quantity
                        </span>
                        <span className="font-semibold">
                          {selectedProduct.availableQuantity} packets
                        </span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-sm text-muted-foreground">
                          Production Cost
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(
                            selectedProduct.productionCostPerPacket
                          )}
                          /packet
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Sale Details */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-primary" />
                Sale Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Number of Packets *</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={quantitySold}
                      onChange={(e) =>
                        setQuantitySold(e.target.value)
                      }
                      disabled={submitting}
                      className={
                        parsedQuantity > 0 && !isQuantityValid
                          ? 'border-destructive pr-20'
                          : 'pr-20'
                      }
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      packets
                    </span>
                  </div>

                  {parsedQuantity > 0 &&
                    selectedProduct &&
                    (quantityInPackets > selectedProduct.availableQuantity ||
                      !Number.isInteger(parsedQuantity)) && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {!Number.isInteger(parsedQuantity)
                          ? 'Quantity must be a whole number'
                          : 'Exceeds available stock'}
                      </p>
                    )}
                </div>

                <div className="space-y-2">
                  <Label>Selling Price per Packet *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      ₹
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      value={sellingPrice}
                      onChange={(e) =>
                        setSellingPrice(e.target.value)
                      }
                      disabled={submitting}
                      className="pl-8"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Discount (%)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={discount}
                      onChange={(e) =>
                        setDiscount(e.target.value)
                      }
                      disabled={submitting}
                      className="pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      %
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Sale Date *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={saleDate}
                      onChange={(e) =>
                        setSaleDate(e.target.value)
                      }
                      disabled={submitting}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Remarks</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) =>
                    setRemarks(e.target.value)
                  }
                  disabled={submitting}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          {parsedQuantity > 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Total Amount
                    </p>
                    <p className="text-lg font-bold">
                      {formatCurrency(totalAmount)}
                    </p>
                  </div>

                  {parsedDiscount > 0 && !isFreeProduct && (
                    <div className="text-center p-3 bg-background rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        Discount
                      </p>
                      <p className="text-lg font-bold text-green-600">
                        -{formatCurrency(discountAmount)}
                      </p>
                    </div>
                  )}

                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      {isFreeProduct ? 'Type' : (parsedDiscount > 0 ? 'Final Amount' : 'Total Amount')}
                    </p>
                    {isFreeProduct ? (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        FREE
                      </Badge>
                    ) : (
                      <p className="text-lg font-bold text-primary">
                        {formatCurrency(finalAmount)}
                      </p>
                    )}
                  </div>

                  {!isFreeProduct && (
                    <div className="text-center p-3 bg-background rounded-lg col-span-2 md:col-span-1">
                      <p className="text-xs text-muted-foreground">
                        Profit
                      </p>
                      <p
                        className={`text-lg font-bold ${
                          finalProfit >= 0
                            ? 'text-green-600'
                            : 'text-destructive'
                        }`}
                      >
                        {formatCurrency(finalProfit)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pb-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/sales')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isFormValid || submitting || loading}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Sale
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}