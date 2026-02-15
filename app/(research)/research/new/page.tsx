'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FlaskConical,
  Calendar,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { getStoredUserName } from '@/lib/auth-utils';

import { researchFormulations } from '@/data/researchData';

interface RawMaterial {
  id: string;
  name: string;
  unit: 'kg' | 'gm';
  costPerUnit: number;
  status: 'active' | 'inactive';
}

interface IngredientRow {
  id: string;
  rawMaterialId: string;
  quantity: string; // user-entered quantity
}

interface CalculatedIngredient {
  rawMaterialId: string;
  name: string;
  quantity: number;
  unit: string;
  percentage: number;
  ratePerKg: number;     // cost per kg normalised
  costContribution: number;
}

export default function ResearchEntry() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;

  const { toast } = useToast();
  const { user } = useAuth();

  const isEditMode = !!id;

  const research = isEditMode
    ? researchFormulations.find((r) => r.id === id)
    : null;

  /* ================= STATE ================= */
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ================= FETCH RAW MATERIALS ================= */
  useEffect(() => {
    const fetchRawMaterials = async () => {
      try {
        const response = await fetch('/api/inventory');
        if (response.ok) {
          const data = await response.json();
          // Only active materials
          setRawMaterials(data.filter((rm: RawMaterial) => rm.status === 'active'));
        }
      } catch (error) {
        console.error('Error fetching raw materials:', error);
      }
    };
    fetchRawMaterials();
  }, []);

  /* ================= UPDATE RESEARCHER NAME ================= */
  useEffect(() => {
    if (!isEditMode && (user?.fullName || getStoredUserName())) {
      setFormData(prev => ({
        ...prev,
        researcherName: user?.fullName || getStoredUserName() || ''
      }));
    }
  }, [user, isEditMode]);

  /* ================= LOAD DATA (EDIT MODE) ================= */
  useEffect(() => {
    if (research) {
      setFormData({
        tempName: research.tempName,
        researcherName: research.researcherName,
        researchDate: research.researchDate,
        baseQuantity: research.baseQuantity.toString(),
        notes: research.notes || '',
      });

      // Edit mode: convert stored percentages back to quantities
      // using saved baseQuantity so quantities are editable
      setIngredients(
        research.ingredients.map((ing, index) => ({
          id: String(index + 1),
          rawMaterialId: ing.rawMaterialId,
          quantity: ((ing.percentage / 100) * research.baseQuantity).toFixed(2),
        }))
      );
    }
  }, [research]);

  /* ================= CALCULATIONS ================= */
  const calculations = useMemo(() => {
    const valid = ingredients.filter(
      (i) => i.rawMaterialId && i.quantity && parseFloat(i.quantity) > 0
    );

    if (valid.length === 0) {
      return { rows: [], totalQtyKg: 0, totalCost: 0, costPerKg: 0, totalPercentage: 0 };
    }

    // 1. Sum all quantities converted to kg
    let totalQtyKg = 0;
    valid.forEach((ing) => {
      const rm = rawMaterials.find((r) => r.id === ing.rawMaterialId);
      if (!rm) return;
      const qty = parseFloat(ing.quantity);
      totalQtyKg += rm.unit === 'gm' ? qty / 1000 : qty;
    });

    // 2. Build per-row calculated values
    let totalCost = 0;
    const rows: CalculatedIngredient[] = valid.map((ing) => {
      const rm = rawMaterials.find((r) => r.id === ing.rawMaterialId)!;
      const qty = parseFloat(ing.quantity);

      // Quantity in kg for percentage calc
      const qtyKg = rm.unit === 'gm' ? qty / 1000 : qty;
      const percentage = totalQtyKg > 0 ? (qtyKg / totalQtyKg) * 100 : 0;

      // Normalise rate to per-kg regardless of material unit
      const ratePerKg = rm.unit === 'gm' ? rm.costPerUnit * 1000 : rm.costPerUnit;

      // Cost = qty in kg × rate per kg
      const costContribution = qtyKg * ratePerKg;
      totalCost += costContribution;

      return {
        rawMaterialId: ing.rawMaterialId,
        name: rm.name,
        quantity: qty,
        unit: rm.unit,
        percentage,
        ratePerKg,
        costContribution,
      };
    });

    const costPerKg = totalQtyKg > 0 ? totalCost / totalQtyKg : 0;
    const totalPercentage = rows.reduce((s, r) => s + r.percentage, 0);

    return { rows, totalQtyKg, totalCost, costPerKg, totalPercentage };
  }, [ingredients, rawMaterials]);

  /* ================= INGREDIENT HELPERS ================= */
  const usedIds = ingredients.filter((i) => i.rawMaterialId).map((i) => i.rawMaterialId);

  const getAvailableRawMaterials = (currentIngId: string) => {
    const currentRmId = ingredients.find((i) => i.id === currentIngId)?.rawMaterialId;
    return rawMaterials.filter(
      (rm) => !usedIds.includes(rm.id) || rm.id === currentRmId
    );
  };

  const addIngredient = () =>
    setIngredients((prev) => [
      ...prev,
      { id: Date.now().toString(), rawMaterialId: '', quantity: '' },
    ]);

  const removeIngredient = (ingId: string) => {
    if (ingredients.length <= 1) return;
    setIngredients((prev) => prev.filter((i) => i.id !== ingId));
  };

  const updateIngredient = (
    ingId: string,
    field: 'rawMaterialId' | 'quantity',
    value: string
  ) =>
    setIngredients((prev) =>
      prev.map((i) => (i.id === ingId ? { ...i, [field]: value } : i))
    );

  const getCalcRow = (rawMaterialId: string) =>
    calculations.rows.find((r) => r.rawMaterialId === rawMaterialId);

  /* ================= VALIDATION ================= */
  const canSubmit =
    formData.tempName &&
    formData.researcherName &&
    formData.researchDate &&
    formData.baseQuantity &&
    calculations.rows.length > 0;

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          baseQuantity: calculations.totalQtyKg,
          baseUnit: 'kg',
          ingredients: calculations.rows.map((r) => ({
            rawMaterialId: r.rawMaterialId,
            percentage: r.percentage,
          })),
        }),
      });

      if (response.ok) {
        toast({
          title: isEditMode ? 'Research Re-submitted' : 'Research Submitted',
          description: `"${formData.tempName}" has been sent for admin approval.`,
        });
        setIsSubmitting(false);
        router.push('/research');
      } else {
        throw new Error('Failed to submit research');
      }
    } catch (error) {
      console.error('Error submitting research:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit research. Please try again.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

  /* ================= UI ================= */
  return (
    <AppLayout>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/research">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="page-title flex items-center gap-2">
                <FlaskConical className="h-6 w-6 text-primary" />
                {isEditMode ? 'Edit Research Formulation' : 'New Research Formulation'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isEditMode
                  ? 'Update and re-submit rejected formulation'
                  : 'Experiment with new masala formulations'}
              </p>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Temporary Masala Name *</Label>
                <Input
                  value={formData.tempName}
                  onChange={(e) => setFormData({ ...formData, tempName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Researcher Name *</Label>
                <Input
                  value={formData.researcherName}
                  onChange={(e) => setFormData({ ...formData, researcherName: e.target.value })}
                  disabled
                />
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
                    onChange={(e) => setFormData({ ...formData, researchDate: e.target.value })}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Base Quantity (kg) *</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.baseQuantity}
                  onChange={(e) => setFormData({ ...formData, baseQuantity: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingredients */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle>Raw Material Breakdown</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
              <Plus className="h-4 w-4 mr-1" />
              Add Row
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Raw Material</TableHead>
                    <TableHead>Qty (kg)</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Rate / kg</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map((ing, index) => {
                    const calc = getCalcRow(ing.rawMaterialId);
                    const rm = rawMaterials.find((r) => r.id === ing.rawMaterialId);

                    return (
                      <TableRow key={ing.id}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>

                        {/* Material Select */}
                        <TableCell>
                          <Select
                            value={ing.rawMaterialId}
                            onValueChange={(v) => updateIngredient(ing.id, 'rawMaterialId', v)}
                          >
                            <SelectTrigger className="min-w-[140px]">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableRawMaterials(ing.id).map((rm) => (
                                <SelectItem key={rm.id} value={rm.id}>
                                  {rm.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Quantity Input */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0"
                              value={ing.quantity}
                              onChange={(e) => updateIngredient(ing.id, 'quantity', e.target.value)}
                              className="w-24"
                            />
                            {rm && (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {rm.unit}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Auto-calculated % */}
                        <TableCell>
                          <span className={`text-sm font-medium ${calc ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {calc ? `${calc.percentage.toFixed(1)}%` : '—'}
                          </span>
                        </TableCell>

                        {/* Rate per kg */}
                        <TableCell>
                          <span className="text-sm">
                            {calc ? fmt(calc.ratePerKg) : '—'}
                          </span>
                        </TableCell>

                        {/* Delete */}
                        <TableCell>
                          {ingredients.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeIngredient(ing.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* Totals row */}
                  {calculations.rows.length > 0 && (
                    <TableRow className="font-semibold bg-muted/40 border-t-2">
                      <TableCell />
                      <TableCell className="text-muted-foreground text-sm">Total</TableCell>
                      <TableCell className="text-sm">
                        {calculations.totalQtyKg.toFixed(2)} kg
                      </TableCell>
                      <TableCell className="text-sm">
                        {calculations.totalPercentage.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-sm">
                        {fmt(calculations.costPerKg)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">/ kg</span>
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Summary footer */}
            <div className="grid grid-cols-2 divide-x border-t">
              <div className={`p-4 ${
                calculations.totalPercentage > 0 && Math.abs(calculations.totalPercentage - 100) < 0.01
                  ? 'bg-green-50'
                  : 'bg-amber-50'
              }`}>
                <div className="text-xs text-muted-foreground mb-0.5">Total Percentage</div>
                <div className="font-semibold text-base">
                  {calculations.totalPercentage > 0
                    ? `${calculations.totalPercentage.toFixed(1)}%`
                    : '0%'}
                </div>
              </div>
              <div className="p-4 bg-primary/5">
                <div className="text-xs text-muted-foreground mb-0.5">Cost per kg</div>
                <div className="font-semibold text-base">
                  {calculations.costPerKg > 0 ? fmt(calculations.costPerKg) : '—'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Research Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href="/research">Cancel</Link>
          </Button>
          <Button type="submit" disabled={!canSubmit || isSubmitting} className="gap-2">
            <Save className="h-4 w-4" />
            {isEditMode ? 'Re-submit for Approval' : 'Submit for Approval'}
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}