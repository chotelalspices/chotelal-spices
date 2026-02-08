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
  percentage: string;
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

export default function EditFormulationPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params?.id as string;

  /* ================= STATE ================= */
  const [name, setName] = useState("");
  const [baseQuantity, setBaseQuantity] = useState("100");
  const [baseUnit, setBaseUnit] = useState<"kg" | "gm">("kg");
  const [defaultQuantity, setDefaultQuantity] = useState("100");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [isLoadingFormulation, setIsLoadingFormulation] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { id: "1", rawMaterialId: "", percentage: "" },
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

  /* ================= FETCH FORMULATION ================= */
  useEffect(() => {
    const fetchFormulation = async () => {
      try {
        setIsLoadingFormulation(true);
        const response = await fetch(`/api/formulations/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Formulation not found');
          }
          throw new Error('Failed to fetch formulation');
        }

        const data: FormulationData = await response.json();
        
        setName(data.name);
        setBaseQuantity(data.baseQuantity.toString());
        setBaseUnit(data.baseUnit);
        setDefaultQuantity(data.defaultQuantity.toString());
        setStatus(data.status);
        
        // Populate ingredients
        if (data.ingredients && data.ingredients.length > 0) {
          setIngredients(
            data.ingredients.map((ing, index) => ({
              id: String(index + 1),
              rawMaterialId: ing.rawMaterialId,
              percentage: ing.percentage.toString(),
            }))
          );
        }
      } catch (error) {
        console.error('Error fetching formulation:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : 'Failed to load formulation.',
          variant: "destructive",
        });
        router.push('/formulations');
      } finally {
        setIsLoadingFormulation(false);
      }
    };

    if (id) {
      fetchFormulation();
    }
  }, [id, router, toast]);

  /* ================= CALCULATIONS ================= */
  const calculateFormulationCosts = (
    ingredients: FormulationIngredient[],
    baseQuantity: number,
    baseUnit: 'kg' | 'gm'
  ): { 
    calculatedIngredients: CalculatedIngredient[]; 
    totalCost: number; 
    costPerKg: number;
    totalPercentage: number;
  } => {
    const calculatedIngredients: CalculatedIngredient[] = [];
    let totalCost = 0;
    let totalPercentage = 0;

    ingredients.forEach(ingredient => {
      const rawMaterial = rawMaterials.find(rm => rm.id === ingredient.rawMaterialId);
      if (!rawMaterial) return;

      totalPercentage += ingredient.percentage;

      // Calculate quantity based on percentage
      const quantity = (ingredient.percentage / 100) * baseQuantity;

      // Calculate cost contribution
      // Need to convert units if necessary
      let costContribution: number;
      if (baseUnit === rawMaterial.unit) {
        costContribution = quantity * rawMaterial.costPerUnit;
      } else if (baseUnit === 'kg' && rawMaterial.unit === 'gm') {
        // Base is kg, material is priced per gm
        // Convert kg to gm for cost calculation
        costContribution = (quantity * 1000) * rawMaterial.costPerUnit;
      } else {
        // Base is gm, material is priced per kg
        // Convert gm to kg for cost calculation
        costContribution = (quantity / 1000) * rawMaterial.costPerUnit;
      }

      totalCost += costContribution;

      calculatedIngredients.push({
        rawMaterialId: ingredient.rawMaterialId,
        rawMaterialName: rawMaterial.name,
        percentage: ingredient.percentage,
        quantity,
        unit: baseUnit,
        ratePerUnit: rawMaterial.costPerUnit,
        costContribution,
      });
    });

    // Calculate cost per kg
    const baseInKg = baseUnit === 'kg' ? baseQuantity : baseQuantity / 1000;
    const costPerKg = baseInKg > 0 ? totalCost / baseInKg : 0;

    return { calculatedIngredients, totalCost, costPerKg, totalPercentage };
  };

  const calculations = useMemo(() => {
    const validIngredients: FormulationIngredient[] = ingredients
      .filter((i) => i.rawMaterialId && i.percentage)
      .map((i) => ({
        rawMaterialId: i.rawMaterialId,
        percentage: parseFloat(i.percentage) || 0,
      }));

    return calculateFormulationCosts(
      validIngredients,
      parseFloat(baseQuantity) || 0,
      baseUnit
    );
  }, [ingredients, baseQuantity, baseUnit, rawMaterials]);

  const isPercentageValid =
    Math.abs(calculations.totalPercentage - 100) < 0.01;

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
        percentage: "",
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
    field: "rawMaterialId" | "percentage",
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

    if (!isPercentageValid) {
      toast({
        title: "Error",
        description: "Total percentage must be exactly 100%",
        variant: "destructive",
      });
      return;
    }

    // Validate that all ingredients have valid raw materials
    const validIngredients = ingredients.filter((i) => i.rawMaterialId && i.percentage);
    if (validIngredients.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one ingredient",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/formulations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          baseQuantity: parseFloat(baseQuantity),
          baseUnit: baseUnit,
          defaultQuantity: parseFloat(defaultQuantity),
          status: status,
          ingredients: validIngredients.map((i) => ({
            rawMaterialId: i.rawMaterialId,
            percentage: parseFloat(i.percentage),
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update formulation');
      }

      toast({
        title: "Formulation updated",
        description: `${name} has been updated successfully.`,
      });

      router.push("/formulations");
    } catch (error) {
      console.error('Error updating formulation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update formulation. Please try again.',
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

  if (isLoadingFormulation) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading formulation...</span>
        </div>
      </AppLayout>
    );
  }

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
            <h1 className="page-title">Edit Formulation</h1>
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

        {/* BASE QUANTITY AND UNIT */}
        <div className="industrial-card p-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="baseQuantity">Base Quantity</Label>
              <Input
                id="baseQuantity"
                type="number"
                min="0"
                step="0.01"
                value={baseQuantity}
                onChange={(e) => setBaseQuantity(e.target.value)}
                placeholder="100"
              />
            </div>
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
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v: "active" | "inactive") => setStatus(v)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* DEFAULT QUANTITY */}
        <div className="industrial-card p-6 mt-6">
          <Label htmlFor="defaultQuantity">Default Quantity (kg)</Label>
          <Input
            id="defaultQuantity"
            type="number"
            min="0"
            step="0.01"
            value={defaultQuantity}
            onChange={(e) => setDefaultQuantity(e.target.value)}
            placeholder="100"
            className="mt-2"
          />
          <p className="text-sm text-muted-foreground mt-2">
            This is the standard production quantity for this formulation (in kilograms).
          </p>
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
                <TableHead>%</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients.map((ing) => {
                const calc = getIngredientCalc(
                  ing.rawMaterialId
                );
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
                        disabled={isLoadingMaterials || isLoadingFormulation}
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
                      <Input
                        type="number"
                        value={ing.percentage}
                        onChange={(e) =>
                          updateIngredient(
                            ing.id,
                            "percentage",
                            e.target.value
                          )
                        }
                      />
                    </TableCell>

                    <TableCell>
                      {calc
                        ? calc.quantity.toFixed(2)
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
                        onClick={() =>
                          removeIngredient(ing.id)
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div
            className={cn(
              "mt-4 p-3 rounded-lg flex gap-2",
              isPercentageValid
                ? "bg-success/10"
                : "bg-destructive/10"
            )}
          >
            {isPercentageValid ? (
              <CheckCircle2 className="text-success" />
            ) : (
              <AlertCircle className="text-destructive" />
            )}
            <span>
              Total:{" "}
              {calculations.totalPercentage.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" asChild>
            <Link href="/formulations">Cancel</Link>
          </Button>
          <Button type="submit" disabled={!isPercentageValid || isSubmitting || isLoadingMaterials || isLoadingFormulation}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}
