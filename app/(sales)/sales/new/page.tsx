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
  User,
  Hash,
} from 'lucide-react';

import { toast } from 'sonner';

import {
  calculateProfit,
  formatCurrency,
} from '@/data/salesData';

interface FinishedProduct {
  id: string;
  name: string;
  formulationId: string;
  formulationName: string;
  batchId?: string | null;
  batchNumber?: string | null;
  availableQuantity: number;
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

  /* ── form state ── */
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantitySold, setQuantitySold] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  /* ── NEW: client fields ── */
  const [clientName, setClientName] = useState('');
  const [voucherNo, setVoucherNo] = useState('');
  const [voucherType, setVoucherType] = useState('');

  /* ── fetch products ── */
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/sales/products');
        if (!res.ok) throw new Error('Failed to fetch products');
        setProducts(await res.json());
      } catch {
        toast.error('Failed to load products. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  /* ── derived values ── */
  const selectedProduct = useMemo(
    () => (selectedProductId ? products.find((p) => p.id === selectedProductId) : undefined),
    [selectedProductId, products]
  );

  const availableProducts = useMemo(
    () => products.filter((p) => p.availableQuantity > 0),
    [products]
  );

  const parsedQuantity = parseFloat(quantitySold) || 0;
  const parsedPrice   = parseFloat(sellingPrice)  || 0;
  const parsedDiscount = parseFloat(discount)     || 0;

  const quantityInPackets = Number.isInteger(parsedQuantity)
    ? parsedQuantity
    : Math.floor(parsedQuantity);

  const isFreeProduct  = parsedPrice === 0;
  const totalAmount    = quantityInPackets * parsedPrice;
  const discountAmount = isFreeProduct ? 0 : totalAmount * (parsedDiscount / 100);
  const finalAmount    = totalAmount - discountAmount;

  const profit = selectedProduct && !isFreeProduct
    ? calculateProfit(quantityInPackets, parsedPrice, selectedProduct.productionCostPerPacket)
    : 0;
  const finalProfit = isFreeProduct ? 0 : profit - discountAmount;

  const isQuantityValid =
    selectedProduct
      ? quantityInPackets > 0 &&
        quantityInPackets <= selectedProduct.availableQuantity &&
        Number.isInteger(parsedQuantity)
      : false;

  const isPriceValid  = parsedPrice >= 0;
  const isFormValid   = selectedProductId && isQuantityValid && isPriceValid && saleDate;

  /* ── submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !selectedProduct) {
      toast.error('Please fill all required fields correctly');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/sales/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductId,
          quantitySold: quantityInPackets,
          sellingPrice: parsedPrice,
          discount: isFreeProduct ? 0 : parsedDiscount,
          productionCost: quantityInPackets * selectedProduct.productionCostPerPacket,
          profit: finalProfit,
          saleDate,
          remarks: remarks || undefined,
          // ── client info ──
          clientName: clientName.trim() || undefined,
          voucherNo:  voucherNo.trim()  || undefined,
          voucherType: voucherType.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create sales record');
      }

      toast.success('Sale recorded successfully', {
        description: `${quantityInPackets} packet${quantityInPackets !== 1 ? 's' : ''} of ${selectedProduct.name} ${
          isFreeProduct
            ? 'given away for free'
            : `sold for ${formatCurrency(finalAmount)}${parsedDiscount > 0 ? ` (${parsedDiscount}% discount)` : ''}`
        }`,
      });

      router.push('/sales');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record sale. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ================================================================
     RENDER
  ================================================================ */
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.push('/sales')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Sales Entry</h1>
            <p className="text-sm text-muted-foreground">Record a new sale</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Client Info ── */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Client Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input
                  placeholder="e.g. Shree Datt Masala Centre (Bhosari-Pune)"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    Voucher No.
                  </Label>
                  <Input
                    placeholder="e.g. CM247"
                    value={voucherNo}
                    onChange={(e) => setVoucherNo(e.target.value)}
                    disabled={submitting}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Voucher Type</Label>
                  <Select
                    value={voucherType}
                    onValueChange={setVoucherType}
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sales GST">Sales GST</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="Credit Note">Credit Note</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Preview band — mirrors the header row in summary/upload */}
              {clientName.trim() && (
                <div className="rounded-lg bg-primary/5 border border-primary/15 px-4 py-3 flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{clientName}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {saleDate}
                      </span>
                      {voucherType && (
                        <>
                          <span className="text-muted-foreground/40">|</span>
                          <span>{voucherType}</span>
                        </>
                      )}
                      {voucherNo.trim() && (
                        <>
                          <span className="text-muted-foreground/40">|</span>
                          <span className="font-mono">{voucherNo}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Product Selection ── */}
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
                      <SelectContent>
                        {availableProducts.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No products available
                          </div>
                        ) : (
                          availableProducts.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedProduct && (
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Available Quantity</span>
                        <span className="font-semibold">{selectedProduct.availableQuantity} packets</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-sm text-muted-foreground">Production Cost</span>
                        <span className="font-semibold">
                          {formatCurrency(selectedProduct.productionCostPerPacket)}/packet
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Sale Details ── */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-primary" />
                Sale Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Quantity */}
                <div className="space-y-2">
                  <Label>Number of Packets *</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={quantitySold}
                      onChange={(e) => setQuantitySold(e.target.value)}
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
                  {parsedQuantity > 0 && selectedProduct &&
                    (quantityInPackets > selectedProduct.availableQuantity || !Number.isInteger(parsedQuantity)) && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {!Number.isInteger(parsedQuantity)
                          ? 'Quantity must be a whole number'
                          : 'Exceeds available stock'}
                      </p>
                    )}
                </div>

                {/* Price */}
                <div className="space-y-2">
                  <Label>Selling Price per Packet *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      disabled={submitting}
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* Discount */}
                <div className="space-y-2">
                  <Label>Discount (%)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      disabled={submitting}
                      className="pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                  </div>
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <Label>Sale Date *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
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
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={submitting}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Summary ── */}
          {parsedQuantity > 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Amount</p>
                    <p className="text-lg font-bold">{formatCurrency(totalAmount)}</p>
                  </div>

                  {parsedDiscount > 0 && !isFreeProduct && (
                    <div className="text-center p-3 bg-background rounded-lg">
                      <p className="text-xs text-muted-foreground">Discount</p>
                      <p className="text-lg font-bold text-green-600">
                        −{formatCurrency(discountAmount)}
                      </p>
                    </div>
                  )}

                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      {isFreeProduct ? 'Type' : parsedDiscount > 0 ? 'Final Amount' : 'Total Amount'}
                    </p>
                    {isFreeProduct ? (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">FREE</Badge>
                    ) : (
                      <p className="text-lg font-bold text-primary">{formatCurrency(finalAmount)}</p>
                    )}
                  </div>

                  {!isFreeProduct && (
                    <div className="text-center p-3 bg-background rounded-lg col-span-2 md:col-span-1">
                      <p className="text-xs text-muted-foreground">Profit</p>
                      <p className={`text-lg font-bold ${finalProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {formatCurrency(finalProfit)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Actions ── */}
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
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />Save Sale</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}