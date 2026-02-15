'use client';

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import {
  FormulationIngredient,
} from "@/data/formulationData";
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

interface IngredientRow {
  id: string;
  rawMaterialId: string;
  quantity: string;
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
  ratePerUnit: number;
  costContribution: number;
}

export default function NewFormulationPage() {
  const router = useRouter();
  const { toast } = useToast();

  /* ================= STATE ================= */
  const [name, setName] = useState("");
  const [baseUnit, setBaseUnit] = useState<"kg" | "gm">("kg");
  const [defaultQuantity, setDefaultQuantity] = useState("100");
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { id: "1", rawMaterialId: "", quantity: "" },
  ]);

  /* ================= FETCH RAW MATERIALS ================= */
  useEffect(() => {
    const fetchRawMaterials = async () => {
      try {
        setIsLoadingMaterials(true);
        const response = await fetch('/api/inventory');
        
        if (!response.ok) {
          throw new Error('Failed to fetch raw materials');
        }

        const data = await response.json();
        // Filter only active materials
        const activeMaterials = data.filter((rm: RawMaterial) => rm.status === 'active');
        setRawMaterials(activeMaterials);
      } catch (error) {
        console.error('Error fetching raw materials:', error);
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

  /* ================= CALCULATIONS ================= */
  const calculations = useMemo(() => {
    const validIngredients = ingredients.filter(
      (i) => i.rawMaterialId && i.quantity && parseFloat(i.quantity) > 0
    );

    if (validIngredients.length === 0) {
      return {
        calculatedIngredients: [],
        totalQuantity: 0,
        totalCost: 0,
        costPerKg: 0,
      };
    }

    // Calculate total quantity in base unit
    let totalQuantityInBaseUnit = 0;
    validIngredients.forEach(ingredient => {
      const qty = parseFloat(ingredient.quantity);
      const rawMaterial = rawMaterials.find(rm => rm.id === ingredient.rawMaterialId);
      
      if (!rawMaterial) return;

      // Convert to base unit if needed
      if (baseUnit === 'kg' && rawMaterial.unit === 'gm') {
        totalQuantityInBaseUnit += qty / 1000;
      } else if (baseUnit === 'gm' && rawMaterial.unit === 'kg') {
        totalQuantityInBaseUnit += qty * 1000;
      } else {
        totalQuantityInBaseUnit += qty;
      }
    });

    const calculatedIngredients: CalculatedIngredient[] = [];
    let totalCost = 0;

    validIngredients.forEach(ingredient => {
      const rawMaterial = rawMaterials.find(rm => rm.id === ingredient.rawMaterialId);
      if (!rawMaterial) return;

      const quantity = parseFloat(ingredient.quantity);

      // Calculate percentage based on quantity
      let quantityInBaseUnit = quantity;
      if (baseUnit === 'kg' && rawMaterial.unit === 'gm') {
        quantityInBaseUnit = quantity / 1000;
      } else if (baseUnit === 'gm' && rawMaterial.unit === 'kg') {
        quantityInBaseUnit = quantity * 1000;
      }
      
      const percentage = (quantityInBaseUnit / totalQuantityInBaseUnit) * 100;

      // Calculate cost contribution
      let costContribution: number;
      if (baseUnit === rawMaterial.unit) {
        costContribution = quantity * rawMaterial.costPerUnit;
      } else if (baseUnit === 'kg' && rawMaterial.unit === 'gm') {
        // Material quantity is in gm, need to convert to match pricing
        costContribution = quantity * rawMaterial.costPerUnit;
      } else {
        // Material quantity is in kg, need to convert to match pricing
        costContribution = quantity * rawMaterial.costPerUnit;
      }

      totalCost += costContribution;

      calculatedIngredients.push({
        rawMaterialId: ingredient.rawMaterialId,
        rawMaterialName: rawMaterial.name,
        percentage,
        quantity,
        unit: rawMaterial.unit,
        ratePerUnit: rawMaterial.costPerUnit,
        costContribution,
      });
    });

    // Calculate cost per kg
    const totalQuantityInKg = baseUnit === 'kg' ? totalQuantityInBaseUnit : totalQuantityInBaseUnit / 1000;
    const costPerKg = totalQuantityInKg > 0 ? totalCost / totalQuantityInKg : 0;

    return {
      calculatedIngredients,
      totalQuantity: totalQuantityInBaseUnit,
      totalCost,
      costPerKg,
    };
  }, [ingredients, baseUnit, rawMaterials]);

  const totalPercentage = calculations.calculatedIngredients.reduce(
    (sum, ing) => sum + ing.percentage,
    0
  );

  const isPercentageValid = Math.abs(totalPercentage - 100) < 0.01;

  const usedMaterialIds = ingredients
    .filter((i) => i.rawMaterialId)
    .map((i) => i.rawMaterialId);

  /* ================= HANDLERS ================= */
  const addIngredient = () => {
    setIngredients((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        rawMaterialId: "",
        quantity: "",
      },
    ]);
  };

  const removeIngredient = (rowId: string) => {
    if (ingredients.length === 1) return;
    setIngredients((prev) =>
      prev.filter((i) => i.id !== rowId)
    );
  };

  const updateIngredient = (
    rowId: string,
    field: "rawMaterialId" | "quantity",
    value: string
  ) => {
    setIngredients((prev) =>
      prev.map((i) =>
        i.id === rowId ? { ...i, [field]: value } : i
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a product name",
        variant: "destructive",
      });
      return;
    }

    // Validate that all ingredients have valid quantities
    const validIngredients = ingredients.filter(
      (i) => i.rawMaterialId && i.quantity && parseFloat(i.quantity) > 0
    );
    
    if (validIngredients.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one ingredient with a quantity",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert quantities to percentages for storage
      const ingredientsWithPercentages = calculations.calculatedIngredients.map((calc) => ({
        rawMaterialId: calc.rawMaterialId,
        percentage: calc.percentage,
      }));

      const response = await fetch('/api/formulations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          baseQuantity: calculations.totalQuantity,
          baseUnit: baseUnit,
          defaultQuantity: parseFloat(defaultQuantity),
          status: 'active',
          ingredients: ingredientsWithPercentages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create formulation');
      }

      toast({
        title: "Formulation created",
        description: `${name} has been created successfully.`,
      });

      router.push("/formulations");
    } catch (error) {
      console.error('Error creating formulation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create formulation. Please try again.',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getIngredientCalc = (rawMaterialId: string) =>
    calculations.calculatedIngredients.find(
      (c) => c.rawMaterialId === rawMaterialId
    );

  return (
    <AppLayout>
      <form onSubmit={handleSubmit}>
        <div className="page-header">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/formulations">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="page-title">New Formulation</h1>
          </div>
        </div>

        {/* PRODUCT NAME */}
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

        {/* BASE UNIT */}
        <div className="industrial-card p-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="baseUnit">Base Unit</Label>
              <Select value={baseUnit} onValueChange={(v: "kg" | "gm") => setBaseUnit(v)}>
                <SelectTrigger id="baseUnit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="gm">gm</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                All calculations will be displayed in this unit
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
              <p className="text-sm text-muted-foreground mt-2">
                Standard production quantity
              </p>
            </div>
          </div>
        </div>

        {/* INGREDIENTS */}
        <div className="industrial-card p-6 mt-6">
          <div className="flex justify-between mb-4">
            <h2 className="section-title">
              Raw Material Breakdown
            </h2>
            <Button
              type="button"
              variant="outline"
              onClick={addIngredient}
            >
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
                <TableHead>Cost</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients.map((ing) => {
                const calc = getIngredientCalc(ing.rawMaterialId);
                const rawMaterial = rawMaterials.find(rm => rm.id === ing.rawMaterialId);
                
                return (
                  <TableRow key={ing.id}>
                    <TableCell>
                      <Select
                        value={ing.rawMaterialId}
                        onValueChange={(v) =>
                          updateIngredient(
                            ing.id,
                            "rawMaterialId",
                            v
                          )
                        }
                        disabled={isLoadingMaterials}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingMaterials ? "Loading..." : "Select"} />
                        </SelectTrigger>
                        <SelectContent>
                          {rawMaterials
                            .filter(
                              (rm) =>
                                !usedMaterialIds.includes(
                                  rm.id
                                ) ||
                                rm.id ===
                                  ing.rawMaterialId
                            )
                            .map((rm) => (
                              <SelectItem
                                key={rm.id}
                                value={rm.id}
                              >
                                {rm.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={ing.quantity}
                          onChange={(e) =>
                            updateIngredient(
                              ing.id,
                              "quantity",
                              e.target.value
                            )
                          }
                          placeholder="0"
                          className="w-24"
                        />
                        {rawMaterial && (
                          <span className="text-sm text-muted-foreground">
                            {rawMaterial.unit}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      {calc
                        ? `${calc.percentage.toFixed(1)}%`
                        : "-"}
                    </TableCell>

                    <TableCell>
                      {calc
                        ? formatCurrency(
                            calc.costContribution
                          )
                        : "-"}
                    </TableCell>

                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          removeIngredient(ing.id)
                        }
                        disabled={ingredients.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {/* TOTALS ROW */}
              {calculations.calculatedIngredients.length > 0 && (
                <TableRow className="font-semibold bg-muted/50">
                  <TableCell>Total</TableCell>
                  <TableCell>
                    {calculations.totalQuantity.toFixed(2)} {baseUnit}
                  </TableCell>
                  <TableCell>
                    {totalPercentage.toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    {formatCurrency(calculations.totalCost)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* SUMMARY CARDS */}
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
                <div className="text-sm text-muted-foreground">
                  Total Percentage
                </div>
                <div className="text-lg font-semibold">
                  {totalPercentage.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="text-sm text-muted-foreground">
                Cost per kg
              </div>
              <div className="text-lg font-semibold">
                {formatCurrency(calculations.costPerKg)} / kg
              </div>
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" asChild>
            <Link href="/formulations">Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting || isLoadingMaterials}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Formulation
              </>
            )}
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}