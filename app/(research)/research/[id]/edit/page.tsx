'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, FlaskConical, Calendar, Save, Plus, Trash2, Package2, X,
  Check, ChevronsUpDown,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/libs/utils';

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
  percentage: number;
}

interface SelectedExtendedItem {
  rowId: string;
  extendedItemId: string;
  quantity: string;
  notes: string;
  comboOpen: boolean;
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

export default function ResearchEdit() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || false;

  const [formData, setFormData] = useState({
    tempName: '',
    researcherName: '',
    researchDate: new Date().toISOString().split('T')[0],
    baseQuantity: '100',
    notes: '',
  });
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { id: '1', rawMaterialId: '', quantity: '', percentage: 0 },
  ]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [extendedItems, setExtendedItems] = useState<ExtendedItem[]>([]);
  const [selectedExtended, setSelectedExtended] = useState<SelectedExtendedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [researchRes, materialsRes, extendedRes] = await Promise.all([
          fetch(`/api/research/${id}`),
          fetch('/api/inventory'),
          fetch('/api/extended-inventory'),
        ]);
        if (!researchRes.ok) throw new Error('Research not found');
        const [researchData, materialsData, extendedData] = await Promise.all([
          researchRes.json(),
          materialsRes.ok ? materialsRes.json() : [],
          extendedRes.ok ? extendedRes.json() : [],
        ]);
        const activeRMs: RawMaterial[] = materialsData.filter((rm: RawMaterial) => rm.status === 'active');
        setRawMaterials(activeRMs);
        setExtendedItems(extendedData);
        setFormData({
          tempName: researchData.tempName || '',
          researcherName: researchData.researcher || '',
          researchDate: researchData.researchDate
            ? new Date(researchData.researchDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          baseQuantity: researchData.baseQuantity?.toString() || '100',
          notes: researchData.notes || '',
        });
        const base = researchData.baseQuantity || 100;
        if (researchData.ingredients?.length > 0) {
          setIngredients(researchData.ingredients.map((ing: any, index: number) => {
            const rm = activeRMs.find(r => r.id === ing.rawMaterialId);
            const qtyKg = (ing.percentage / 100) * base;
            const qty = rm?.unit === 'gm' ? (qtyKg * 1000).toFixed(2) : qtyKg.toFixed(2);
            return { id: String(index + 1), rawMaterialId: ing.rawMaterialId, quantity: qty, percentage: ing.percentage };
          }));
        }
        if (researchData.extendedItems?.length > 0) {
          setSelectedExtended(researchData.extendedItems.map((item: any, index: number) => ({
            rowId: String(Date.now() + index),
            extendedItemId: item.extendedInventoryId,
            quantity: item.quantity?.toString() || '',
            notes: item.notes || '',
            comboOpen: false,
          })));
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to load research formulation', variant: 'destructive' });
        router.push('/research');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchAll();
  }, [id]);

  // ── Raw material calc rows ────────────────────────────────────────────────

  const rmRows = useMemo((): CalculatedIngredient[] => {
    const valid = ingredients.filter(i => i.rawMaterialId && i.quantity && parseFloat(i.quantity) > 0);
    return valid.map(ing => {
      const rm = rawMaterials.find(r => r.id === ing.rawMaterialId);
      if (!rm) return null!;
      const qty = parseFloat(ing.quantity);
      const qtyKg = rm.unit === 'gm' ? qty / 1000 : qty;
      const ratePerKg = rm.unit === 'gm' ? rm.costPerUnit * 1000 : rm.costPerUnit;
      return { rawMaterialId: ing.rawMaterialId, name: rm.name, quantity: qty, unit: rm.unit, qtyKg, ratePerKg, costContribution: qtyKg * ratePerKg };
    }).filter(Boolean);
  }, [ingredients, rawMaterials]);

  const rmTotalQtyKg = useMemo(() => rmRows.reduce((s, r) => s + r.qtyKg, 0), [rmRows]);
  const rmTotalCost = useMemo(() => rmRows.reduce((s, r) => s + r.costContribution, 0), [rmRows]);

  // ── Extended total ────────────────────────────────────────────────────────

  const extendedTotalQtyKg = useMemo(
    () => selectedExtended.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0),
    [selectedExtended]
  );

  // ── Combined ──────────────────────────────────────────────────────────────

  const combinedTotalQtyKg = rmTotalQtyKg + extendedTotalQtyKg;
  const getPct = (qtyKg: number) => combinedTotalQtyKg > 0 ? (qtyKg / combinedTotalQtyKg) * 100 : 0;
  const combinedCostPerKg = combinedTotalQtyKg > 0 ? rmTotalCost / combinedTotalQtyKg : 0;

  const ingredientsPayload = useMemo(() => {
    if (rmRows.length === 0) return [];

    const rawPcts = rmRows.map(r =>
      rmTotalQtyKg > 0 ? (r.qtyKg / rmTotalQtyKg) * 100 : 0
    );

    let accumulated = 0;

    return rmRows.map((r, i) => {
      let pct: number;

      if (i === rmRows.length - 1) {
        pct = parseFloat((100 - accumulated).toFixed(4));
      } else {
        pct = parseFloat(rawPcts[i].toFixed(4));
        accumulated += pct;
      }

      return {
        rawMaterialId: r.rawMaterialId,
        percentage: pct,
      };
    });
  }, [rmRows, rmTotalQtyKg]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

  // ── Ingredient helpers ────────────────────────────────────────────────────

  const usedRMIds = ingredients.filter(i => i.rawMaterialId).map(i => i.rawMaterialId);
  const getAvailableRMs = (currentIngId: string) => {
    const cur = ingredients.find(i => i.id === currentIngId)?.rawMaterialId;
    return rawMaterials.filter(rm => !usedRMIds.includes(rm.id) || rm.id === cur);
  };
  const addIngredient = () => setIngredients(prev => [...prev, { id: Date.now().toString(), rawMaterialId: '', quantity: '', percentage: 0 }]);
  const removeIngredient = (ingId: string) => { if (ingredients.length <= 1) return; setIngredients(prev => prev.filter(i => i.id !== ingId)); };
  const updateIngredient = (ingId: string, field: 'rawMaterialId' | 'quantity', value: string) =>
    setIngredients(prev => prev.map(i => i.id === ingId ? { ...i, [field]: value } : i));
  const getRmRow = (rawMaterialId: string) => rmRows.find(r => r.rawMaterialId === rawMaterialId);

  // ── Extended helpers ──────────────────────────────────────────────────────

  const addExtendedItem = () => setSelectedExtended(prev => [...prev, { rowId: Date.now().toString(), extendedItemId: '', quantity: '', notes: '', comboOpen: false }]);
  const removeExtendedItem = (rowId: string) => setSelectedExtended(prev => prev.filter(r => r.rowId !== rowId));
  const updateExtendedItem = (rowId: string, field: keyof Omit<SelectedExtendedItem, 'rowId'>, value: string | boolean) =>
    setSelectedExtended(prev => prev.map(r => r.rowId === rowId ? { ...r, [field]: value } : r));
  const usedExtendedIds = selectedExtended.map(r => r.extendedItemId).filter(Boolean);

  const canSubmit = formData.tempName && formData.researcherName && formData.researchDate && rmRows.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/research/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempName: formData.tempName,
          researcherName: formData.researcherName,
          researchDate: formData.researchDate,
          baseQuantity: combinedTotalQtyKg,
          baseUnit: 'kg',
          notes: formData.notes,
          ingredients: ingredientsPayload,
          extendedItems: selectedExtended
            .filter(r => r.extendedItemId)
            .map(r => ({
              extendedInventoryId: r.extendedItemId,
              quantity: parseFloat(r.quantity) || 0,
              percentage: getPct(parseFloat(r.quantity) || 0),
              notes: r.notes || null,
            })),
        }),
      });

      if (!res.ok) throw new Error('Failed to update research');

      toast({
        title: 'Research Updated',
        description: `"${formData.tempName}" has been re-submitted for approval.`,
      });

      router.push('/research');
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update research. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px] flex-col gap-4">
          <FlaskConical className="h-12 w-12 text-muted-foreground/50 animate-pulse" />
          <h3 className="text-lg font-medium">Loading research formulation...</h3>
        </div>
      </AppLayout>
    );
  }

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
                Edit Research Formulation
              </h1>
              <p className="text-muted-foreground mt-1">Update and re-submit for admin approval</p>
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
                <Input value={formData.tempName} onChange={e => setFormData({ ...formData, tempName: e.target.value })} />
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
                  <Input type="date" value={formData.researchDate} onChange={e => setFormData({ ...formData, researchDate: e.target.value })} className="pl-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Base Quantity (kg)</Label>
                <Input value={combinedTotalQtyKg > 0 ? combinedTotalQtyKg.toFixed(3) : formData.baseQuantity} readOnly className="bg-muted/50" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Raw Material Breakdown — no summary strip */}
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
                    const row = getRmRow(ing.rawMaterialId);
                    const rm = rawMaterials.find(r => r.id === ing.rawMaterialId);
                    return (
                      <TableRow key={ing.id}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                          <Select value={ing.rawMaterialId} onValueChange={v => updateIngredient(ing.id, 'rawMaterialId', v)}>
                            <SelectTrigger className="min-w-[140px]"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {getAvailableRMs(ing.id).map(rm => (
                                <SelectItem key={rm.id} value={rm.id}>{rm.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Input type="number" min="0" step="0.01" placeholder="0" value={ing.quantity}
                              onChange={e => updateIngredient(ing.id, 'quantity', e.target.value)} className="w-24" />
                            {rm && <span className="text-xs text-muted-foreground">{rm.unit}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-medium ${row ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {row && combinedTotalQtyKg > 0 ? `${getPct(row.qtyKg).toFixed(1)}%` : '—'}
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
            {/* No strip here — shown below extended section */}
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
              <p className="text-sm text-muted-foreground mt-1">Reference external product samples. No cost/% calculation.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addExtendedItem} disabled={extendedItems.length === 0}>
              <Plus className="h-4 w-4 mr-1" />Add Item
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {extendedItems.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm px-6">
                No extended inventory items available.{' '}
                <button type="button" className="text-primary underline" onClick={() => router.push('/research/extended-inventory')}>
                  Add some first
                </button>
              </div>
            ) : selectedExtended.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Click "Add Item" to reference extended inventory products.
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
                      <TableHead>Notes</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedExtended.map((row, index) => {
                      const selected = extendedItems.find(e => e.id === row.extendedItemId);
                      const available = extendedItems.filter(e => !usedExtendedIds.includes(e.id) || e.id === row.extendedItemId);
                      const qty = parseFloat(row.quantity) || 0;
                      const pct = getPct(qty);
                      return (
                        <TableRow key={row.rowId}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell>
                            <Popover open={row.comboOpen} onOpenChange={open => updateExtendedItem(row.rowId, 'comboOpen', open)}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="min-w-[200px] justify-between font-normal">
                                  <span className="truncate">
                                    {selected ? `${selected.productName}${selected.code ? ` (${selected.code})` : ''}` : 'Select item...'}
                                  </span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[320px] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search product name or code..." />
                                  <CommandList className="max-h-[200px]">
                                    <CommandEmpty>No items found.</CommandEmpty>
                                    <CommandGroup>
                                      {available.map(item => (
                                        <CommandItem key={item.id} value={`${item.productName} ${item.code || ''}`}
                                          onSelect={() => { updateExtendedItem(row.rowId, 'extendedItemId', item.id); updateExtendedItem(row.rowId, 'comboOpen', false); }}>
                                          <Check className={cn('mr-2 h-4 w-4', row.extendedItemId === item.id ? 'opacity-100' : 'opacity-0')} />
                                          <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{item.productName}</p>
                                            <div className="flex gap-2 text-xs text-muted-foreground">
                                              {item.code && <span className="font-mono">{item.code}</span>}
                                              {isAdmin && item.companyName && <span>{item.companyName}</span>}
                                            </div>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="0" step="0.001" placeholder="0.000" value={row.quantity}
                              onChange={e => updateExtendedItem(row.rowId, 'quantity', e.target.value)} className="w-24" />
                          </TableCell>
                          <TableCell>
                            <span className={`text-sm font-medium ${pct > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {pct > 0 ? `${pct.toFixed(1)}%` : '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Input placeholder="Optional notes..." value={row.notes}
                              onChange={e => updateExtendedItem(row.rowId, 'notes', e.target.value)} className="text-sm h-9 w-32" />
                          </TableCell>
                          <TableCell>
                            <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"
                              onClick={() => removeExtendedItem(row.rowId)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {selectedExtended.filter(r => parseFloat(r.quantity) > 0).length > 0 && (
                      <TableRow className="font-semibold bg-muted/40 border-t-2">
                        <TableCell />
                        <TableCell className="text-muted-foreground text-sm">Subtotal</TableCell>
                        <TableCell className="text-sm">{extendedTotalQtyKg.toFixed(3)} kg</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {combinedTotalQtyKg > 0 ? `${getPct(extendedTotalQtyKg).toFixed(1)}%` : '—'}
                        </TableCell>
                        <TableCell /><TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* ── Single unified summary strip ── */}
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
            <Textarea rows={4} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" asChild><Link href="/research">Cancel</Link></Button>
          <Button type="submit" disabled={!canSubmit || isSubmitting} className="gap-2">
            <Save className="h-4 w-4" />
            {isSubmitting ? 'Saving...' : 'Re-submit for Approval'}
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}