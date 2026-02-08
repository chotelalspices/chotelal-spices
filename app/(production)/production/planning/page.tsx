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
import { useToast } from "@/hooks/use-toast";

import {
  MaterialRequirement,
  hasInsufficientStock,
  formatCurrency,
} from "@/data/productionData";
import { formatDate } from "@/data/sampleData";
import { useIsMobile } from "@/hooks/use-mobile";
import { Formulation } from "@/data/formulationData";

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

export default function ProductionPlanning() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [activeFormulations, setActiveFormulations] = useState<Formulation[]>([]);
  const [plannedProductions, setPlannedProductions] = useState<PlannedProduction[]>([]);
  const [isLoadingFormulations, setIsLoadingFormulations] = useState(true);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);

  const [formData, setFormData] = useState({
    formulationId: "",
    plannedQuantity: "",
    numberOfLots: "1",
    plannedDate: "",
  });

  const [availabilityResult, setAvailabilityResult] = useState<{
    checked: boolean;
    sufficient: boolean;
    insufficientMaterials: string[];
    requirements: MaterialRequirement[];
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch formulations
  useEffect(() => {
    const fetchFormulations = async () => {
      try {
        setIsLoadingFormulations(true);
        const response = await fetch("/api/formulations");

        if (!response.ok) {
          throw new Error("Failed to fetch formulations");
        }

        const data = await response.json();
        setActiveFormulations(data.filter((f: Formulation) => f.status === "active"));
      } catch (error) {
        console.error("Error fetching formulations:", error);
        toast({
          title: "Error",
          description: "Failed to load formulations. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingFormulations(false);
      }
    };

    fetchFormulations();
  }, [toast]);

  // Fetch planned productions
  useEffect(() => {
    const fetchPlannedProductions = async () => {
      try {
        setIsLoadingPlans(true);
        const response = await fetch("/api/production/planning");

        if (!response.ok) {
          throw new Error("Failed to fetch planned productions");
        }

        const data = await response.json();
        setPlannedProductions(data);
      } catch (error) {
        console.error("Error fetching planned productions:", error);
        toast({
          title: "Error",
          description: "Failed to load planned productions. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingPlans(false);
      }
    };

    fetchPlannedProductions();
  }, [toast]);

  const selectedFormulation = activeFormulations.find(
    (f) => f.id === formData.formulationId
  );

  const finalQuantity = formData.plannedQuantity && formData.numberOfLots
    ? Number(formData.plannedQuantity) * Number(formData.numberOfLots)
    : 0;

  const handleCheckAvailability = async () => {
    if (!selectedFormulation || !formData.plannedQuantity) return;

    try {
      const response = await fetch(
        `/api/production/materials?formulationId=${selectedFormulation.id}&plannedQuantity=${finalQuantity}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch material requirements");
      }

      const requirements: MaterialRequirement[] = await response.json();
      const insufficient = hasInsufficientStock(requirements);
      const insufficientMaterials = requirements
        .filter((req) => req.stockStatus === "insufficient")
        .map((req) => req.rawMaterialName);

      setAvailabilityResult({
        checked: true,
        sufficient: !insufficient,
        insufficientMaterials,
        requirements,
      });
    } catch (error) {
      console.error("Error checking availability:", error);
      toast({
        title: "Error",
        description: "Failed to check material availability. Please try again.",
        variant: "destructive",
      });
    }
  };

  const canSubmit =
    formData.formulationId &&
    formData.plannedQuantity &&
    Number(formData.plannedQuantity) > 0 &&
    formData.numberOfLots &&
    Number(formData.numberOfLots) > 0 &&
    formData.plannedDate &&
    availabilityResult?.checked;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedFormulation) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/production/planning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          formulationId: formData.formulationId,
          plannedQuantity: Number(formData.plannedQuantity),
          numberOfLots: Number(formData.numberOfLots),
          finalQuantity: finalQuantity,
          unit: selectedFormulation.baseUnit,
          plannedDate: formData.plannedDate,
          materialStatus: availabilityResult?.sufficient
            ? "sufficient"
            : "insufficient",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create production plan");
      }

      const planData = await response.json();

      toast({
        title: "Production Plan Created",
        description: `Production of ${formData.plannedQuantity} ${selectedFormulation.baseUnit} × ${formData.numberOfLots} lots = ${finalQuantity} ${selectedFormulation.baseUnit} ${selectedFormulation.name} scheduled for ${formData.plannedDate}. Email notification sent to Admin & Packaging teams.`,
      });

      // Refresh planned productions list
      const plansResponse = await fetch("/api/production/planning");
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setPlannedProductions(plansData);
      }

      // Reset form
      handleReset();
    } catch (error) {
      console.error("Error creating production plan:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create production plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      formulationId: "",
      plannedQuantity: "",
      numberOfLots: "1",
      plannedDate: "",
    });
    setAvailabilityResult(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
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
                Plan future production and check material availability
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Planning Form */}
          <Card>
            <CardHeader>
              <CardTitle>New Production Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Masala Selection */}
              <div className="space-y-2">
                <Label>Masala Name *</Label>
                <Select
                  value={formData.formulationId}
                  onValueChange={(value) => {
                    const formulation = activeFormulations.find((f) => f.id === value);
                    setFormData({ 
                      ...formData, 
                      formulationId: value,
                      plannedQuantity: formulation?.defaultQuantity?.toString() || ''
                    });
                    setAvailabilityResult(null);
                  }}
                  disabled={isLoadingFormulations}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        isLoadingFormulations ? "Loading..." : "Select masala..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {activeFormulations.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Planned Quantity */}
              <div className="space-y-2">
                <Label>Planned Quantity *</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={formData.plannedQuantity}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        plannedQuantity: e.target.value,
                      });
                      setAvailabilityResult(null);
                    }}
                    min="1"
                    step="0.1"
                  />
                  <div className="flex items-center px-4 bg-muted rounded-md text-sm font-medium">
                    {selectedFormulation?.baseUnit || "kg"}
                  </div>
                </div>
              </div>

              {/* Number of Lots */}
              <div className="space-y-2">
                <Label>Number of Lots *</Label>
                <Select
                  value={formData.numberOfLots}
                  onValueChange={(value) => {
                    setFormData({ ...formData, numberOfLots: value });
                    setAvailabilityResult(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select number of lots" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Final Quantity */}
              <div className="space-y-2">
                <Label>Final Production Quantity</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={finalQuantity.toFixed(2)}
                    readOnly
                    className="bg-muted"
                  />
                  <div className="flex items-center px-4 bg-muted rounded-md text-sm font-medium">
                    {selectedFormulation?.baseUnit || "kg"}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Calculated as: Planned Quantity × Number of Lots
                </p>
              </div>

              {/* Planned Date */}
              <div className="space-y-2">
                <Label>Planned Date *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={formData.plannedDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        plannedDate: e.target.value,
                      })
                    }
                    className="pl-10"
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleCheckAvailability}
                disabled={
                  !formData.formulationId ||
                  !formData.plannedQuantity ||
                  isLoadingFormulations
                }
              >
                Check Material Availability
              </Button>

              {/* Availability Result */}
              {availabilityResult?.checked && (
                <div
                  className={`rounded-lg p-4 ${
                    availabilityResult.sufficient
                      ? "bg-green-50 border border-green-200"
                      : "bg-destructive/10 border border-destructive/20"
                  }`}
                >
                  <div className="flex gap-3">
                    {availabilityResult.sufficient ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    )}
                    <div>
                      <p className="font-medium">
                        {availabilityResult.sufficient
                          ? "All Materials Available"
                          : "Insufficient Materials"}
                      </p>
                      {availabilityResult.sufficient ? (
                        <div className="flex items-center gap-2 text-sm text-blue-600 mt-2">
                          <Mail className="h-4 w-4" />
                          Email notification will be sent to Admin & Packaging teams
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">
                            Missing:{" "}
                            {availabilityResult.insufficientMaterials.join(", ")}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-blue-600 mt-2">
                            <Mail className="h-4 w-4" />
                            Email notification will be sent to Admin & Packaging teams
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  Reset
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                  className="flex-1 gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isSubmitting ? "Saving..." : "Save Plan"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Material Requirements Preview */}
          {availabilityResult && availabilityResult.requirements && availabilityResult.requirements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Material Requirements</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isMobile ? (
                  <div className="divide-y">
                    {availabilityResult.requirements.map((req) => (
                      <div key={req.rawMaterialId} className="p-4">
                        <div className="flex justify-between">
                          <p className="font-medium">{req.rawMaterialName}</p>
                          <Badge
                            variant={
                              req.stockStatus === "sufficient"
                                ? "default"
                                : "destructive"
                            }
                          >
                            {req.stockStatus === "sufficient" ? "OK" : "Low"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                          <div>
                            Required: {req.requiredQuantity.toFixed(2)}{" "}
                            {req.unit}
                          </div>
                          <div>
                            Available: {req.availableStock.toFixed(2)} {req.unit}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Required</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availabilityResult.requirements.map((req) => (
                        <TableRow key={req.rawMaterialId}>
                          <TableCell className="font-medium">
                            {req.rawMaterialName}
                          </TableCell>
                          <TableCell className="text-right">
                            {req.requiredQuantity.toFixed(2)} {req.unit}
                          </TableCell>
                          <TableCell className="text-right">
                            {req.availableStock.toFixed(2)} {req.unit}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={
                                req.stockStatus === "sufficient"
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {req.stockStatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Upcoming Plans */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Production Plans</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Masala</TableHead>
                  <TableHead className="text-right">Planned Qty</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingPlans ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : plannedProductions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No planned productions found
                    </TableCell>
                  </TableRow>
                ) : (
                  plannedProductions.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>{plan.formulationName}</TableCell>
                      <TableCell className="text-right">
                        {plan.plannedQuantity} {plan.unit}
                      </TableCell>
                      <TableCell>{formatDate(plan.plannedDate)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            plan.materialStatus === "sufficient"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {plan.materialStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {/* {plan.emailSent && (
                        )} */}
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
    </AppLayout>
  );
}
