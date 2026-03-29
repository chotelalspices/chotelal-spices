'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, FlaskConical, Calendar, Save, Plus, Trash2, Package2,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { getStoredUserName } from '@/lib/auth-utils';

interface RawMaterial {
  id: string;
  name: string;
  unit: 'kg' | 'gm';
  costPerUnit: number;
  status: 'active' | 'inactive';
}

interface ExtendedItem {
  id: string;
  productName: string;
  companyName: string | null;
  code: string | null;
  price: number;
  date: string;
}

interface IngredientRow {
  id: string;
  rawMaterialId: string;
  quantity: string;
}

interface ExtendedRow {
  id: string;
  extendedItemId: string;
  quantity: string;
  notes: string;
}

interface CalculatedIngredient {
  rawMaterialId: string;
  name: string;
  quantity: number;
  unit: string;
  qtyKg: number;
  ratePerKg: number;
  costContribution: number;
}

export default function ResearchEntry() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditMode = !!id;
  const isAdmin = user?.roles?.includes('admin') || false;

  const [formData, setFormData] = useState({
    tempName: '',
    researcherName: user?.fullName || getStoredUserName() || '',
    researchDate: new Date().toISOString().split('T')[0],
    baseQuantity: '100',
    notes: '',
  });
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { id: '1', rawMaterialId: '', quantity: '' },
  ]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [extendedItems, setExtendedItems] = useState<ExtendedItem[]>([]);
  const [extendedRows, setExtendedRows] = useState<ExtendedRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/inventory').then(r => r.ok ? r.json() : [])
      .then(d => setRawMaterials(d.filter((rm: RawMaterial) => rm.status === 'active')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/extended-inventory').then(r => r.ok ? r.json() : [])
      .then(d => setExtendedItems(d)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEditMode && (user?.fullName || getStoredUserName())) {
      setFormData(prev => ({ ...prev, researcherName: user?.fullName || getStoredUserName() || '' }));
    }
  }, [user, isEditMode]);

  // ── Load existing research for edit mode ──────────────────────────────────
  useEffect(() => {
    if (!isEditMode) return;
    fetch(`/api/research/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setFormData({
          tempName: data.tempName || '',
          researcherName: data.researcher || data.researcherName || '',
          researchDate: data.researchDate
            ? new Date(data.researchDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          baseQuantity: data.baseQuantity?.toString() || '100',
          notes: data.notes || '',
        });
        if (data.ingredients?.length > 0) {
          setIngredients(data.ingredients.map((ing: any, index: number) => ({
            id: String(index + 1),
            rawMaterialId: ing.rawMaterialId,
            // Convert stored percentage back to absolute qty using baseQuantity
            quantity: ((ing.percentage / 100) * data.baseQuantity).toFixed(2),
          })));
        }
        if (data.extendedItems?.length > 0) {
          setExtendedRows(data.extendedItems.map((item: any, index: number) => ({
            id: String(Date.now() + index),
            extendedItemId: item.extendedInventoryId || item.id,
            quantity: item.quantity?.toString() || '',
            notes: item.notes || '',
          })));
        }
      })
      .catch(() => toast({ title: 'Error', description: 'Failed to load research data', variant: 'destructive' }));
  }, [id, isEditMode]);

  // ── Raw material calculations ─────────────────────────────────────────────

  const rmRows = useMemo((): CalculatedIngredient[] => {
    const valid = ingredients.filter(i => i.rawMaterialId && i.quantity && parseFloat(i.quantity) > 0);
    return valid.map(ing => {
      const rm = rawMaterials.find(r => r.id === ing.rawMaterialId);
      if (!rm) return null!;
      const qty = parseFloat(ing.quantity);
      const qtyKg = rm.unit === 'gm' ? qty / 1000 : qty;
      const ratePerKg = rm.unit === 'gm' ? rm.costPerUnit * 1000 : rm.costPerUnit;
      return {
        rawMaterialId: ing.rawMaterialId,
        name: rm.name,
        quantity: qty,
        unit: rm.unit,
        qtyKg,
        ratePerKg,
        costContribution: qtyKg * ratePerKg,
      };
    }).filter(Boolean);
  }, [ingredients, rawMaterials]);

  const rmTotalQtyKg = useMemo(() => rmRows.reduce((s, r) => s + r.qtyKg, 0), [rmRows]);
  const rmTotalCost  = useMemo(() => rmRows.reduce((s, r) => s + r.costContribution, 0), [rmRows]);

  const extendedTotalQtyKg = useMemo(
    () => extendedRows.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0),
    [extendedRows],
  );

  const combinedTotalQtyKg = rmTotalQtyKg + extendedTotalQtyKg;

  const getPct = (qtyKg: number) =>
    combinedTotalQtyKg > 0 ? (qtyKg / combinedTotalQtyKg) * 100 : 0;

  const combinedCostPerKg = combinedTotalQtyKg > 0 ? rmTotalCost / combinedTotalQtyKg : 0;

  // ── Build ingredient payload — percentages guaranteed to sum to 100 ────────
  // We compute raw percentages first, then adjust the last row so the sum is
  // exactly 100.000 (avoids floating-point drift that was causing the 100% check to fail).
  const ingredientsPayload = useMemo(() => {
    if (rmRows.length === 0) return [];
    const rawPcts = rmRows.map(r => getPct(r.qtyKg));
    // Fix rounding: subtract accumulated sum from 100 for the last item
    let accumulated = 0;
    return rmRows.map((r, i) => {
      let pct: number;
      if (i === rmRows.length - 1) {
        pct = parseFloat((100 - accumulated).toFixed(4));
      } else {
        pct = parseFloat(rawPcts[i].toFixed(4));
        accumulated += pct;
      }
      return { rawMaterialId: r.rawMaterialId, percentage: pct };
    });
  }, [rmRows, combinedTotalQtyKg]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

  // ── Ingredient helpers ────────────────────────────────────────────────────

  const usedRmIds = ingredients.filter(i => i.rawMaterialId).map(i => i.rawMaterialId);
  const getAvailableRm = (ingId: string) => {
    const cur = ingredients.find(i => i.id === ingId)?.rawMaterialId;
    return rawMaterials.filter(rm => !usedRmIds.includes(rm.id) || rm.id === cur);
  };
  const addIngredient = () =>
    setIngredients(prev => [...prev, { id: Date.now().toString(), rawMaterialId: '', quantity: '' }]);
  const removeIngredient = (ingId: string) => {
    if (ingredients.length <= 1) return;
    setIngredients(prev => prev.filter(i => i.id !== ingId));
  };
  const updateIngredient = (ingId: string, field: 'rawMaterialId' | 'quantity', value: string) =>
    setIngredients(prev => prev.map(i => i.id === ingId ? { ...i, [field]: value } : i));

  // ── Extended row helpers ──────────────────────────────────────────────────

  const usedExtendedIds = extendedRows.map(r => r.extendedItemId).filter(Boolean);
  const addExtendedRow = () =>
    setExtendedRows(prev => [...prev, { id: Date.now().toString(), extendedItemId: '', quantity: '', notes: '' }]);
  const removeExtendedRow = (rowId: string) =>
    setExtendedRows(prev => prev.filter(r => r.id !== rowId));
  const updateExtendedRow = (rowId: string, field: keyof Omit<ExtendedRow, 'id'>, value: string) =>
    setExtendedRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));

  const canSubmit =
    formData.tempName &&
    formData.researcherName &&
    formData.researchDate &&
    formData.baseQuantity &&
    rmRows.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        baseQuantity: combinedTotalQtyKg,
        baseUnit: 'kg',
        // Percentages guaranteed to sum to exactly 100
        ingredients: ingredientsPayload,
        extendedItems: extendedRows
          .filter(r => r.extendedItemId)
          .map(r => ({
            extendedInventoryId: r.extendedItemId,
            quantity: parseFloat(r.quantity) || 0,
            percentage: getPct(parseFloat(r.quantity) || 0),
            notes: r.notes || null,
          })),
      };

      const url    = isEditMode ? `/api/research/${id}` : '/api/research';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({
          title: isEditMode ? 'Research Updated' : 'Research Submitted',
          description: `"${formData.tempName}" has been sent for admin approval.`,
        });
        router.push('/research');
      } else {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit research');
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to submit research. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">

        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/research"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <h1 className="page-title flex items-center gap-2">
                <FlaskConical className="h-6 w-6 text-primary" />
                {isEditMode ? 'Edit Research Formulation' : 'New Research Formulation'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isEditMode ? 'Update and re-submit for approval' : 'Experiment with new masala formulations'}
              </p>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Temporary Masala Name *</Label>
                <Input
                  value={formData.tempName}
                  onChange={e => setFormData({ ...formData, tempName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Researcher Name *</Label>
                <Input value={formData.researcherName} disabled />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Research Date *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={formData.researchDate}
                    onChange={e => setFormData({ ...formData, researchDate: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Base Quantity (kg) *</Label>
                <Input
                  type="number" min="1"
                  value={formData.baseQuantity}
                  onChange={e => setFormData({ ...formData, baseQuantity: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Raw Material Breakdown */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>Raw Material Breakdown</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
              <Plus className="h-4 w-4 mr-1" />Add Row
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Raw Material</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Rate / kg</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map((ing, index) => {
                    const row = rmRows.find(r => r.rawMaterialId === ing.rawMaterialId);
                    const rm  = rawMaterials.find(r => r.id === ing.rawMaterialId);
                    const pct = row ? getPct(row.qtyKg) : 0;
                    return (
                      <TableRow key={ing.id}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          <Select
                            value={ing.rawMaterialId}
                            onValueChange={v => updateIngredient(ing.id, 'rawMaterialId', v)}
                          >
                            <SelectTrigger className="min-w-[140px]">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableRm(ing.id).map(rm => (
                                <SelectItem key={rm.id} value={rm.id}>{rm.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number" min="0" step="0.01" placeholder="0"
                              value={ing.quantity}
                              onChange={e => updateIngredient(ing.id, 'quantity', e.target.value)}
                              className="w-24"
                            />
                            {rm && <span className="text-xs text-muted-foreground whitespace-nowrap">{rm.unit}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-medium ${row ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {row && combinedTotalQtyKg > 0 ? `${pct.toFixed(1)}%` : '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{row ? fmt(row.ratePerKg) : '—'}</span>
                        </TableCell>
                        <TableCell>
                          {ingredients.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeIngredient(ing.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {rmRows.length > 0 && (
                    <TableRow className="font-semibold bg-muted/40 border-t-2">
                      <TableCell />
                      <TableCell className="text-muted-foreground text-sm">Subtotal</TableCell>
                      <TableCell className="text-sm">{rmTotalQtyKg.toFixed(2)} kg</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {combinedTotalQtyKg > 0 ? `${getPct(rmTotalQtyKg).toFixed(1)}%` : '—'}
                      </TableCell>
                      <TableCell /><TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Extended Inventory Items */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package2 className="h-5 w-5 text-primary" />
                Extended Inventory Items
                <span className="text-sm font-normal text-muted-foreground">(Optional)</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Reference external product samples. Qty and % are stored for reference only.
              </p>
            </div>
            <Button
              type="button" variant="outline" size="sm"
              onClick={addExtendedRow}
              disabled={extendedItems.length === 0}
            >
              <Plus className="h-4 w-4 mr-1" />Add Row
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {extendedItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm px-6">
                No extended inventory items available.{' '}
                <button type="button" className="text-primary underline"
                  onClick={() => router.push('/research/extended-inventory')}>
                  Add some first
                </button>
              </div>
            ) : extendedRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Click "Add Row" to reference extended inventory items.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Qty (kg)</TableHead>
                      <TableHead>%</TableHead>
                      <TableHead>Price / kg</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extendedRows.map((row, index) => {
                      const selected  = extendedItems.find(e => e.id === row.extendedItemId);
                      const available = extendedItems.filter(e =>
                        !usedExtendedIds.includes(e.id) || e.id === row.extendedItemId
                      );
                      const qty = parseFloat(row.quantity) || 0;
                      const pct = getPct(qty);
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell>
                            <Select
                              value={row.extendedItemId}
                              onValueChange={v => updateExtendedRow(row.id, 'extendedItemId', v)}
                            >
                              <SelectTrigger className="min-w-[180px]">
                                <SelectValue placeholder="Select item" />
                              </SelectTrigger>
                              <SelectContent>
                                {available.map(item => (
                                  <SelectItem key={item.id} value={item.id}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{item.productName}</span>
                                      {(item.code || (isAdmin && item.companyName)) && (
                                        <span className="text-xs text-muted-foreground">
                                          {item.code && <span className="font-mono mr-1">{item.code}</span>}
                                          {isAdmin && item.companyName && item.companyName}
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number" min="0" step="0.001" placeholder="0.000"
                              value={row.quantity}
                              onChange={e => updateExtendedRow(row.id, 'quantity', e.target.value)}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <span className={`text-sm font-medium ${pct > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {pct > 0 ? `${pct.toFixed(1)}%` : '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {selected && selected.price > 0 ? fmt(selected.price) : '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Optional..." value={row.notes}
                              onChange={e => updateExtendedRow(row.id, 'notes', e.target.value)}
                              className="w-32 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeExtendedRow(row.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {extendedRows.filter(r => parseFloat(r.quantity) > 0).length > 0 && (
                      <TableRow className="font-semibold bg-muted/40 border-t-2">
                        <TableCell />
                        <TableCell className="text-muted-foreground text-sm">Subtotal</TableCell>
                        <TableCell className="text-sm">{extendedTotalQtyKg.toFixed(3)} kg</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {combinedTotalQtyKg > 0 ? `${getPct(extendedTotalQtyKg).toFixed(1)}%` : '—'}
                        </TableCell>
                        <TableCell /><TableCell /><TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Unified summary strip */}
            {combinedTotalQtyKg > 0 && (
              <div className="grid grid-cols-3 divide-x border-t">
                <div className="p-4">
                  <div className="text-xs text-muted-foreground mb-0.5">Combined Qty</div>
                  <div className="font-semibold text-base">{combinedTotalQtyKg.toFixed(2)} kg</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {rmTotalQtyKg.toFixed(2)} RM
                    {extendedTotalQtyKg > 0 && ` + ${extendedTotalQtyKg.toFixed(3)} Ext`}
                  </div>
                </div>
                <div className="p-4 bg-green-50">
                  <div className="text-xs text-muted-foreground mb-0.5">Total Percentage</div>
                  <div className="font-semibold text-base">100%</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    RM {getPct(rmTotalQtyKg).toFixed(1)}%
                    {extendedTotalQtyKg > 0 && ` · Ext ${getPct(extendedTotalQtyKg).toFixed(1)}%`}
                  </div>
                </div>
                <div className="p-4 bg-primary/5">
                  <div className="text-xs text-muted-foreground mb-0.5">Cost per kg</div>
                  <div className="font-semibold text-base">{combinedCostPerKg > 0 ? fmt(combinedCostPerKg) : '—'}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">based on raw materials</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle>Research Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              rows={4}
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" asChild><Link href="/research">Cancel</Link></Button>
          <Button type="submit" disabled={!canSubmit || isSubmitting} className="gap-2">
            <Save className="h-4 w-4" />
            {isEditMode ? 'Re-submit for Approval' : 'Submit for Approval'}
          </Button>
        </div>

      </form>
    </AppLayout>
  );
}