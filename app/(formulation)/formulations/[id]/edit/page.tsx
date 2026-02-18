'use client';

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { formatCurrency } from "@/data/sampleData";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { cn } from "@/libs/utils";
import { useToast } from "@/hooks/use-toast";

/* ================================================================
   TYPES
================================================================ */

interface IngredientRow {
  id: string;
  rawMaterialId: string;
  quantity: string;   // user-entered quantity in material's own unit
}

interface RawMaterial {
  id: string;
  name: string;
  unit: 'kg' | 'gm';
  costPerUnit: number;
  availableStock: number;
  minimumStock: number;
  status: 'active' | 'inactive';
  description?: string;
  createdAt: string;
}

interface CalculatedIngredient {
  rawMaterialId: string;
  rawMaterialName: string;
  percentage: number;
  quantity: number;
  unit: 'kg' | 'gm';
  ratePerKg: number;
  costContribution: number;
}

interface FormulationData {
  id: string;
  name: string;
  baseQuantity: number;
  baseUnit: 'kg' | 'gm';
  defaultQuantity: number;
  status: 'active' | 'inactive';
  ingredients: Array<{
    rawMaterialId: string;
    rawMaterialName: string;
    rawMaterialUnit: 'kg' | 'gm';
    rawMaterialCostPerUnit: number;
    percentage: number;
  }>;
}

/* ================================================================
   COMPONENT
================================================================ */

export default function EditFormulationPage() {
  const params  = useParams();
  const router  = useRouter();
  const { toast } = useToast();
  const id = params?.id as string;

  /* ── state ── */
  const [name, setName]                           = useState("");
  const [baseUnit, setBaseUnit]                   = useState<"kg" | "gm">("kg");
  const [defaultQuantity, setDefaultQuantity]     = useState("100");
  const [status, setStatus]                       = useState<"active" | "inactive">("active");
  const [rawMaterials, setRawMaterials]           = useState<RawMaterial[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [isLoadingFormulation, setIsLoadingFormulation] = useState(true);
  const [isSubmitting, setIsSubmitting]           = useState(false);

  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { id: "1", rawMaterialId: "", quantity: "" },
  ]);

  /* ================================================================
     FETCH RAW MATERIALS
  ================================================================ */
  useEffect(() => {
    const fetchRawMaterials = async () => {
      try {
        setIsLoadingMaterials(true);
        const res = await fetch('/api/inventory');
        if (!res.ok) throw new Error('Failed to fetch raw materials');
        const data = await res.json();
        setRawMaterials(data.filter((rm: RawMaterial) => rm.status === 'active'));
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to load raw materials. Please refresh the page.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingMaterials(false);
      }
    };
    fetchRawMaterials();
  }, [toast]);

  /* ================================================================
     FETCH FORMULATION  — convert stored percentages → quantities
  ================================================================ */
  useEffect(() => {
    if (!id) return;

    const fetchFormulation = async () => {
      try {
        setIsLoadingFormulation(true);
        const res = await fetch(`/api/formulations/${id}`);

        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Formulation not found' : 'Failed to fetch formulation');
        }

        const data: FormulationData = await res.json();

        setName(data.name);
        setBaseUnit(data.baseUnit);
        setDefaultQuantity(data.defaultQuantity.toString());
        setStatus(data.status);

        // Convert stored percentages back to quantities using baseQuantity
        if (data.ingredients?.length > 0) {
          setIngredients(
            data.ingredients.map((ing, index) => ({
              id: String(index + 1),
              rawMaterialId: ing.rawMaterialId,
              // quantity = (percentage / 100) * baseQuantity, in baseUnit
              quantity: ((ing.percentage / 100) * data.baseQuantity).toFixed(3),
            }))
          );
        }
      } catch (err) {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : 'Failed to load formulation.',
          variant: "destructive",
        });
        router.push('/formulations');
      } finally {
        setIsLoadingFormulation(false);
      }
    };

    fetchFormulation();
  }, [id, router, toast]);

  /* ================================================================
     CALCULATIONS  — quantity-first, same logic as new formulation page
  ================================================================ */
  const calculations = useMemo(() => {
    const valid = ingredients.filter(
      (i) => i.rawMaterialId && i.quantity && parseFloat(i.quantity) > 0
    );

    if (valid.length === 0) {
      return { calculatedIngredients: [], totalQtyKg: 0, totalCost: 0, costPerKg: 0, totalPercentage: 0 };
    }

    // 1. Sum all quantities in kg
    let totalQtyKg = 0;
    valid.forEach((ing) => {
      const rm  = rawMaterials.find((r) => r.id === ing.rawMaterialId);
      if (!rm) return;
      const qty = parseFloat(ing.quantity);
      totalQtyKg += rm.unit === 'gm' ? qty / 1000 : qty;
    });

    // 2. Per-row values
    let totalCost = 0;
    const calculatedIngredients: CalculatedIngredient[] = valid.map((ing) => {
      const rm  = rawMaterials.find((r) => r.id === ing.rawMaterialId)!;
      const qty = parseFloat(ing.quantity);

      const qtyKg        = rm.unit === 'gm' ? qty / 1000 : qty;
      const percentage   = totalQtyKg > 0 ? (qtyKg / totalQtyKg) * 100 : 0;
      const ratePerKg    = rm.unit === 'gm' ? rm.costPerUnit * 1000 : rm.costPerUnit;
      const costContribution = qtyKg * ratePerKg;

      totalCost += costContribution;

      return {
        rawMaterialId:   ing.rawMaterialId,
        rawMaterialName: rm.name,
        percentage,
        quantity: qty,
        unit:     rm.unit,
        ratePerKg,
        costContribution,
      };
    });

    const costPerKg      = totalQtyKg > 0 ? totalCost / totalQtyKg : 0;
    const totalPercentage = calculatedIngredients.reduce((s, r) => s + r.percentage, 0);

    return { calculatedIngredients, totalQtyKg, totalCost, costPerKg, totalPercentage };
  }, [ingredients, rawMaterials]);

  const isPercentageValid = calculations.calculatedIngredients.length > 0 &&
    Math.abs(calculations.totalPercentage - 100) < 0.01;

  const usedMaterialIds = ingredients
    .filter((i) => i.rawMaterialId)
    .map((i) => i.rawMaterialId);

  /* ================================================================
     HANDLERS
  ================================================================ */
  const addIngredient = () =>
    setIngredients((prev) => [
      ...prev,
      { id: Date.now().toString(), rawMaterialId: "", quantity: "" },
    ]);

  const removeIngredient = (rowId: string) => {
    if (ingredients.length === 1) return;
    setIngredients((prev) => prev.filter((i) => i.id !== rowId));
  };

  const updateIngredient = (
    rowId: string,
    field: "rawMaterialId" | "quantity",
    value: string
  ) =>
    setIngredients((prev) =>
      prev.map((i) => (i.id === rowId ? { ...i, [field]: value } : i))
    );

  const getCalcRow = (rawMaterialId: string) =>
    calculations.calculatedIngredients.find((c) => c.rawMaterialId === rawMaterialId);

  /* ── submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({ title: "Error", description: "Please enter a product name", variant: "destructive" });
      return;
    }

    const validIngredients = ingredients.filter(
      (i) => i.rawMaterialId && i.quantity && parseFloat(i.quantity) > 0
    );

    if (validIngredients.length === 0) {
      toast({ title: "Error", description: "Please add at least one ingredient", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/formulations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          baseQuantity: calculations.totalQtyKg,
          baseUnit,
          defaultQuantity: parseFloat(defaultQuantity),
          status,
          // Save as percentages (same schema as new formulation)
          ingredients: calculations.calculatedIngredients.map((c) => ({
            rawMaterialId: c.rawMaterialId,
            percentage:    c.percentage,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update formulation');

      toast({ title: "Formulation updated", description: `${name} has been updated successfully.` });
      router.push("/formulations");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to update formulation. Please try again.',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================================================================
     LOADING STATE
  ================================================================ */
  if (isLoadingFormulation) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading formulation…</span>
        </div>
      </AppLayout>
    );
  }

  /* ================================================================
     RENDER
  ================================================================ */
  return (
    <AppLayout>
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/formulations"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <h1 className="page-title">Edit Formulation</h1>
          </div>
        </div>

        {/* Product Name */}
        <div className="industrial-card p-6">
          <Label htmlFor="productName">Masala / Product Name</Label>
          <Input
            id="productName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter product name (e.g., Garam Masala)"
            className="mt-2"
          />
        </div>

        {/* Base Unit / Default Qty / Status */}
        <div className="industrial-card p-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="baseUnit">Base Unit</Label>
              <Select value={baseUnit} onValueChange={(v: "kg" | "gm") => setBaseUnit(v)}>
                <SelectTrigger id="baseUnit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="gm">gm</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                All calculations are displayed in this unit
              </p>
            </div>

            <div>
              <Label htmlFor="defaultQuantity">Default Quantity (kg)</Label>
              <Input
                id="defaultQuantity"
                type="number"
                min="0"
                step="0.01"
                value={defaultQuantity}
                onChange={(e) => setDefaultQuantity(e.target.value)}
                placeholder="100"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Standard production quantity
              </p>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v: "active" | "inactive") => setStatus(v)}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Raw Material Breakdown */}
        <div className="industrial-card p-6 mt-6">
          <div className="flex justify-between mb-4">
            <h2 className="section-title">Raw Material Breakdown</h2>
            <Button type="button" variant="outline" onClick={addIngredient}>
              <Plus className="h-4 w-4 mr-1" />
              Add Row
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Rate / kg</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients.map((ing) => {
                const calc = getCalcRow(ing.rawMaterialId);
                const rm   = rawMaterials.find((r) => r.id === ing.rawMaterialId);

                return (
                  <TableRow key={ing.id}>
                    {/* Material select */}
                    <TableCell>
                      <Select
                        value={ing.rawMaterialId}
                        onValueChange={(v) => updateIngredient(ing.id, "rawMaterialId", v)}
                        disabled={isLoadingMaterials || isLoadingFormulation}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingMaterials ? "Loading…" : "Select"} />
                        </SelectTrigger>
                        <SelectContent>
                          {rawMaterials
                            .filter((r) => !usedMaterialIds.includes(r.id) || r.id === ing.rawMaterialId)
                            .map((r) => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Quantity input */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="0"
                          value={ing.quantity}
                          onChange={(e) => updateIngredient(ing.id, "quantity", e.target.value)}
                          className="w-24"
                        />
                        {rm && (
                          <span className="text-sm text-muted-foreground">{rm.unit}</span>
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
                        {calc ? formatCurrency(calc.ratePerKg) : '—'}
                      </span>
                    </TableCell>

                    {/* Delete */}
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeIngredient(ing.id)}
                        disabled={ingredients.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Totals row */}
              {calculations.calculatedIngredients.length > 0 && (
                <TableRow className="font-semibold bg-muted/50 border-t-2">
                  <TableCell>Total</TableCell>
                  <TableCell>
                    {calculations.totalQtyKg.toFixed(3)} kg
                  </TableCell>
                  <TableCell>
                    {calculations.totalPercentage.toFixed(1)}%
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Summary footer — identical to new formulation page */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div
              className={cn(
                "p-4 rounded-lg flex items-center gap-3",
                isPercentageValid
                  ? "bg-success/10 border border-success/20"
                  : "bg-destructive/10 border border-destructive/20"
              )}
            >
              {isPercentageValid ? (
                <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              )}
              <div>
                <div className="text-sm text-muted-foreground">Total Percentage</div>
                <div className="text-lg font-semibold">
                  {calculations.totalPercentage > 0
                    ? `${calculations.totalPercentage.toFixed(1)}%`
                    : '0%'}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="text-sm text-muted-foreground">Cost per kg</div>
              <div className="text-lg font-semibold">
                {calculations.costPerKg > 0
                  ? `${formatCurrency(calculations.costPerKg)} / kg`
                  : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" asChild>
            <Link href="/formulations">Cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isLoadingMaterials || isLoadingFormulation || calculations.calculatedIngredients.length === 0}
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />Save Changes</>
            )}
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}