"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Calendar,
  Save,
  CheckCircle,
  AlertTriangle,
  Mail,
  Loader2,
  Plus,
  Trash2,
  PackagePlus,
  ChevronRight,
  FlaskConical,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

import {
  MaterialRequirement,
  hasInsufficientStock,
  formatCurrency,
} from "@/data/productionData";
import { formatDate } from "@/data/sampleData";
import { useIsMobile } from "@/hooks/use-mobile";
import { Formulation } from "@/data/formulationData";

/* ================================================================
   TYPES
================================================================ */
interface PlannedProduction {
  id: string;
  formulationId: string;
  formulationName: string;
  plannedQuantity: number;
  numberOfLots: number;
  finalQuantity: number;
  unit: "kg" | "gm";
  plannedDate: string;
  materialStatus: "sufficient" | "insufficient";
  emailSent: boolean;
  createdBy: string;
  createdAt: string;
}

// A plan that's been staged locally before final submission
interface StagedPlan {
  localId: string; // temp ID for UI
  formulationId: string;
  formulationName: string;
  plannedQuantity: number;
  numberOfLots: number;
  finalQuantity: number;
  unit: "kg" | "gm";
  plannedDate: string;
}

// Aggregated material requirement across all staged plans
interface AggregatedRequirement {
  rawMaterialId: string;
  rawMaterialName: string;
  unit: string;
  totalRequired: number;
  availableStock: number;
  stockStatus: "sufficient" | "insufficient";
  // breakdown by plan
  planBreakdown: { formulationName: string; required: number }[];
}

/* ================================================================
   COMPONENT
================================================================ */
export default function ProductionPlanning() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  /* ---------- server data ---------- */
  const [activeFormulations, setActiveFormulations] = useState<Formulation[]>([]);
  const [savedPlans, setSavedPlans] = useState<PlannedProduction[]>([]);
  const [isLoadingFormulations, setIsLoadingFormulations] = useState(true);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);

  /* ---------- form state ---------- */
  const [formData, setFormData] = useState({
    formulationId: "",
    plannedQuantity: "",
    numberOfLots: "1",
    plannedDate: "",
  });

  /* ---------- staged (cart) plans ---------- */
  const [stagedPlans, setStagedPlans] = useState<StagedPlan[]>([]);

  /* ---------- review / submit state ---------- */
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [aggregatedRequirements, setAggregatedRequirements] = useState<AggregatedRequirement[]>([]);
  const [isCheckingMaterials, setIsCheckingMaterials] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---------- "add more?" dialog ---------- */
  const [showAddMoreDialog, setShowAddMoreDialog] = useState(false);

  /* ================================================================
     FETCH
  ================================================================ */
  useEffect(() => {
    const fetchFormulations = async () => {
      try {
        setIsLoadingFormulations(true);
        const res = await fetch("/api/formulations");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setActiveFormulations(data.filter((f: Formulation) => f.status === "active"));
      } catch {
        toast({ title: "Error", description: "Failed to load formulations.", variant: "destructive" });
      } finally {
        setIsLoadingFormulations(false);
      }
    };
    fetchFormulations();
  }, [toast]);

  useEffect(() => {
    const fetchSavedPlans = async () => {
      try {
        setIsLoadingPlans(true);
        const res = await fetch("/api/production/planning");
        if (!res.ok) throw new Error();
        setSavedPlans(await res.json());
      } catch {
        toast({ title: "Error", description: "Failed to load production plans.", variant: "destructive" });
      } finally {
        setIsLoadingPlans(false);
      }
    };
    fetchSavedPlans();
  }, [toast]);

  /* ================================================================
     DERIVED VALUES
  ================================================================ */
  const selectedFormulation = activeFormulations.find((f) => f.id === formData.formulationId);
  const finalQuantity =
    formData.plannedQuantity && formData.numberOfLots
      ? Number(formData.plannedQuantity) * Number(formData.numberOfLots)
      : 0;

  const alreadyStagedIds = stagedPlans.map((p) => p.formulationId);

  const canAddPlan =
    !!formData.formulationId &&
    !!formData.plannedQuantity &&
    Number(formData.plannedQuantity) > 0 &&
    Number(formData.numberOfLots) > 0 &&
    !!formData.plannedDate;

  /* ================================================================
     HANDLERS — form
  ================================================================ */
  const resetForm = () =>
    setFormData({ formulationId: "", plannedQuantity: "", numberOfLots: "1", plannedDate: "" });

  const handleAddToPlan = () => {
    if (!canAddPlan || !selectedFormulation) return;

    const newPlan: StagedPlan = {
      localId: Date.now().toString(),
      formulationId: formData.formulationId,
      formulationName: selectedFormulation.name,
      plannedQuantity: Number(formData.plannedQuantity),
      numberOfLots: Number(formData.numberOfLots),
      finalQuantity,
      unit: selectedFormulation.baseUnit,
      plannedDate: formData.plannedDate,
    };

    setStagedPlans((prev) => [...prev, newPlan]);
    resetForm();

    // Ask if user wants to add more
    setShowAddMoreDialog(true);
  };

  const removeStagedPlan = (localId: string) =>
    setStagedPlans((prev) => prev.filter((p) => p.localId !== localId));

  /* ================================================================
     HANDLERS — review & submit
  ================================================================ */
  const handleReviewAll = async () => {
    if (stagedPlans.length === 0) return;
    setIsCheckingMaterials(true);
    setShowReviewModal(true);

    try {
      // Fetch requirements for every staged plan and merge them
      const allRequirementsMap = new Map<string, AggregatedRequirement>();

      for (const plan of stagedPlans) {
        const res = await fetch(
          `/api/production/materials?formulationId=${plan.formulationId}&plannedQuantity=${plan.finalQuantity}`
        );
        if (!res.ok) continue;
        const reqs: MaterialRequirement[] = await res.json();

        reqs.forEach((req) => {
          const existing = allRequirementsMap.get(req.rawMaterialId);
          if (existing) {
            existing.totalRequired += req.requiredQuantity;
            existing.planBreakdown.push({
              formulationName: plan.formulationName,
              required: req.requiredQuantity,
            });
            // Re-evaluate status with aggregated quantity
            existing.stockStatus =
              existing.totalRequired > existing.availableStock
                ? "insufficient"
                : "sufficient";
          } else {
            allRequirementsMap.set(req.rawMaterialId, {
              rawMaterialId: req.rawMaterialId,
              rawMaterialName: req.rawMaterialName,
              unit: req.unit,
              totalRequired: req.requiredQuantity,
              availableStock: req.availableStock,
              stockStatus:
                req.requiredQuantity > req.availableStock
                  ? "insufficient"
                  : "sufficient",
              planBreakdown: [
                {
                  formulationName: plan.formulationName,
                  required: req.requiredQuantity,
                },
              ],
            });
          }
        });
      }

      setAggregatedRequirements(Array.from(allRequirementsMap.values()));
    } catch {
      toast({ title: "Error", description: "Failed to check material availability.", variant: "destructive" });
    } finally {
      setIsCheckingMaterials(false);
    }
  };

  const insufficientMaterials = aggregatedRequirements.filter(
    (r) => r.stockStatus === "insufficient"
  );

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Save every staged plan
      for (const plan of stagedPlans) {
        const materialStatus =
          aggregatedRequirements.some(
            (r) =>
              r.stockStatus === "insufficient" &&
              r.planBreakdown.some((b) => b.formulationName === plan.formulationName)
          )
            ? "insufficient"
            : "sufficient";

        await fetch("/api/production/planning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formulationId: plan.formulationId,
            plannedQuantity: plan.plannedQuantity,
            numberOfLots: plan.numberOfLots,
            finalQuantity: plan.finalQuantity,
            unit: plan.unit,
            plannedDate: plan.plannedDate,
            materialStatus,
          }),
        });
      }

      // Send ONE consolidated email for insufficient materials only
      if (insufficientMaterials.length > 0) {
        await fetch("/api/production/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plans: stagedPlans,
            insufficientMaterials,
          }),
        });
      }

      toast({
        title: "Production Plans Saved",
        description: `${stagedPlans.length} plan(s) saved.${
          insufficientMaterials.length > 0
            ? ` Email sent to Admin with ${insufficientMaterials.length} insufficient material(s).`
            : " All materials are sufficient — no email needed."
        }`,
      });

      // Refresh saved list
      const res = await fetch("/api/production/planning");
      if (res.ok) setSavedPlans(await res.json());

      // Reset everything
      setStagedPlans([]);
      setAggregatedRequirements([]);
      setShowReviewModal(false);
    } catch {
      toast({ title: "Error", description: "Failed to save production plans.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================================================================
     RENDER
  ================================================================ */
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="page-header">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/production">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="page-title flex items-center gap-2">
                <CalendarClock className="h-6 w-6 text-primary" />
                Production Planning
              </h1>
              <p className="text-muted-foreground mt-1">
                Plan multiple productions and review material requirements in one go
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* ── Left: Add-Plan Form ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackagePlus className="h-5 w-5 text-primary" />
                Add Production Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Masala */}
              <div className="space-y-2">
                <Label>Masala Name *</Label>
                <Select
                  value={formData.formulationId}
                  onValueChange={(value) => {
                    const f = activeFormulations.find((f) => f.id === value);
                    setFormData({
                      ...formData,
                      formulationId: value,
                      plannedQuantity: f?.defaultQuantity?.toString() || "",
                    });
                  }}
                  disabled={isLoadingFormulations}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={isLoadingFormulations ? "Loading..." : "Select masala…"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {activeFormulations.map((f) => (
                      <SelectItem
                        key={f.id}
                        value={f.id}
                        disabled={alreadyStagedIds.includes(f.id)}
                      >
                        {f.name}
                        {alreadyStagedIds.includes(f.id) && (
                          <span className="ml-2 text-xs text-muted-foreground">(added)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Planned Qty */}
              <div className="space-y-2">
                <Label>Planned Quantity *</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={formData.plannedQuantity}
                    onChange={(e) =>
                      setFormData({ ...formData, plannedQuantity: e.target.value })
                    }
                    min="1"
                    step="0.1"
                  />
                  <div className="flex items-center px-4 bg-muted rounded-md text-sm font-medium min-w-[48px] justify-center">
                    {selectedFormulation?.baseUnit || "kg"}
                  </div>
                </div>
              </div>

              {/* Lots */}
              <div className="space-y-2">
                <Label>Number of Lots *</Label>
                <Select
                  value={formData.numberOfLots}
                  onValueChange={(v) => setFormData({ ...formData, numberOfLots: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} {n === 1 ? "lot" : "lots"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Final qty readout */}
              {finalQuantity > 0 && (
                <div className="rounded-lg bg-muted/50 px-4 py-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">Final production quantity</span>
                  <span className="font-semibold">
                    {finalQuantity.toFixed(2)} {selectedFormulation?.baseUnit || "kg"}
                  </span>
                </div>
              )}

              {/* Date */}
              <div className="space-y-2">
                <Label>Planned Date *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={formData.plannedDate}
                    onChange={(e) =>
                      setFormData({ ...formData, plannedDate: e.target.value })
                    }
                    className="pl-10"
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>

              <Button
                type="button"
                className="w-full gap-2"
                onClick={handleAddToPlan}
                disabled={!canAddPlan}
              >
                <Plus className="h-4 w-4" />
                Add to Plan
              </Button>
            </CardContent>
          </Card>

          {/* ── Right: Staged Plans ── */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" />
                Planned Productions
                {stagedPlans.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {stagedPlans.length}
                  </Badge>
                )}
              </CardTitle>
              {stagedPlans.length > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={handleReviewAll}
                >
                  Review & Submit
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {stagedPlans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground gap-2 px-4">
                  <PackagePlus className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No plans added yet.</p>
                  <p className="text-xs">Fill the form on the left and click "Add to Plan".</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Masala</TableHead>
                      <TableHead className="text-right">Qty × Lots</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stagedPlans.map((plan) => (
                      <TableRow key={plan.localId}>
                        <TableCell className="font-medium">{plan.formulationName}</TableCell>
                        <TableCell className="text-right text-sm">
                          <span className="font-semibold">{plan.finalQuantity.toFixed(0)}</span>
                          <span className="text-muted-foreground ml-1">{plan.unit}</span>
                          <span className="text-muted-foreground text-xs block">
                            {plan.plannedQuantity} × {plan.numberOfLots} lot(s)
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(plan.plannedDate)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeStagedPlan(plan.localId)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Saved Plans History ── */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Production Plans</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Masala</TableHead>
                  <TableHead className="text-right">Final Qty</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingPlans ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : savedPlans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No planned productions found
                    </TableCell>
                  </TableRow>
                ) : (
                  savedPlans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>{plan.formulationName}</TableCell>
                      <TableCell className="text-right">
                        {plan.finalQuantity} {plan.unit}
                      </TableCell>
                      <TableCell>{formatDate(plan.plannedDate)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={plan.materialStatus === "sufficient" ? "default" : "destructive"}
                        >
                          {plan.materialStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Mail className="h-4 w-4 text-amber-600" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================
          "Add More?" Dialog
      ================================================================ */}
      <Dialog open={showAddMoreDialog} onOpenChange={setShowAddMoreDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Plan Added!</DialogTitle>
            <DialogDescription>
              {stagedPlans.length} production plan{stagedPlans.length > 1 ? "s" : ""} in queue.
              Would you like to add another?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:flex-row flex-col">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowAddMoreDialog(false);
                handleReviewAll();
              }}
            >
              No, Review & Submit
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={() => setShowAddMoreDialog(false)}
            >
              <Plus className="h-4 w-4" />
              Add Another
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================
          Review Modal
      ================================================================ */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Production Plans</DialogTitle>
            <DialogDescription>
              Reviewing material requirements across all {stagedPlans.length} planned production(s).
            </DialogDescription>
          </DialogHeader>

          {/* Plans Summary */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Production Plans ({stagedPlans.length})
            </h3>
            <div className="grid gap-2">
              {stagedPlans.map((plan) => (
                <div
                  key={plan.localId}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{plan.formulationName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(plan.plannedDate)} · {plan.plannedQuantity} {plan.unit} × {plan.numberOfLots} lot(s)
                    </p>
                  </div>
                  <span className="font-semibold text-sm">
                    {plan.finalQuantity.toFixed(0)} {plan.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Material Requirements */}
          <div className="space-y-3 mt-2">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Combined Material Requirements
            </h3>

            {isCheckingMaterials ? (
              <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Checking availability across all plans…
              </div>
            ) : aggregatedRequirements.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No requirements found.
              </p>
            ) : (
              <>
                {/* Insufficient banner */}
                {insufficientMaterials.length > 0 ? (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">
                        {insufficientMaterials.length} material{insufficientMaterials.length > 1 ? "s" : ""} insufficient
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {insufficientMaterials.map((m) => m.rawMaterialName).join(", ")}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-blue-600 mt-2">
                        <Mail className="h-4 w-4" />
                        A single email with the full list will be sent to Admin on submit.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-700">All materials sufficient</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        No email notification required.
                      </p>
                    </div>
                  </div>
                )}

                {/* Table — only show insufficient rows, collapsed sufficient */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Required</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Shortfall</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Insufficient first */}
                    {aggregatedRequirements
                      .sort((a, b) =>
                        a.stockStatus === "insufficient" ? -1 : 1
                      )
                      .map((req) => {
                        const shortfall =
                          req.totalRequired - req.availableStock;
                        return (
                          <TableRow
                            key={req.rawMaterialId}
                            className={
                              req.stockStatus === "insufficient"
                                ? "bg-destructive/5"
                                : ""
                            }
                          >
                            <TableCell className="font-medium">
                              {req.rawMaterialName}
                              {/* per-plan breakdown tooltip */}
                              {req.planBreakdown.length > 1 && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {req.planBreakdown.map((b) => (
                                    <span key={b.formulationName} className="mr-2">
                                      {b.formulationName}: {b.required.toFixed(2)} {req.unit}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {req.totalRequired.toFixed(2)} {req.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              {req.availableStock.toFixed(2)} {req.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              {req.stockStatus === "insufficient" ? (
                                <span className="text-destructive font-semibold">
                                  −{shortfall.toFixed(2)} {req.unit}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={
                                  req.stockStatus === "sufficient"
                                    ? "default"
                                    : "destructive"
                                }
                              >
                                {req.stockStatus === "sufficient" ? "OK" : "Short"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </>
            )}
          </div>

          <DialogFooter className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowReviewModal(false)}
              disabled={isSubmitting}
            >
              Back to Edit
            </Button>
            <Button
              onClick={handleConfirmSubmit}
              disabled={isCheckingMaterials || isSubmitting}
              className="gap-2 min-w-[160px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Confirm & Submit
                  {insufficientMaterials.length > 0 && (
                    <Badge variant="destructive" className="ml-1">
                      {insufficientMaterials.length} alerts
                    </Badge>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}