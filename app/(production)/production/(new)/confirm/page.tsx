"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  Factory,
  Package,
  IndianRupee,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

import {
  MaterialRequirement,
  calculateBatchSummary,
  formatCurrency,
} from "@/data/productionData";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";

interface ProductionEntryData {
  formulationId: string;
  formulationName: string;
  plannedQuantity: number;
  availableQuantity: number;
  producedQuantity: number;
  numberOfLots: number;
  finalQuantity: number;
  unit: "kg" | "gm";
  productionDate: string;
}

export default function ProductionConfirm() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [entryData, setEntryData] = useState<ProductionEntryData | null>(null);
  const [requirements, setRequirements] = useState<MaterialRequirement[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchNumber, setBatchNumber] = useState<string>("");

  useEffect(() => {
    const storedEntry = sessionStorage.getItem("productionEntry");
    const storedReqs = sessionStorage.getItem("materialRequirements");

    if (!storedEntry || !storedReqs) {
      router.replace("/production/new");
      return;
    }

    setEntryData(JSON.parse(storedEntry));
    setRequirements(JSON.parse(storedReqs));

    // Generate batch number (will be generated on server, but show placeholder)
    const year = new Date().getFullYear();
    setBatchNumber(`BATCH-${year}-XXX`);
  }, [router]);

  if (!entryData) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // No loss during production - loss happens during packaging
  const summary = calculateBatchSummary(
    entryData.finalQuantity,
    0, // No loss during production
    requirements
  );

  const handleConfirm = async () => {
    if (!entryData) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/production/batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          formulationId: entryData.formulationId,
          plannedQuantity: entryData.plannedQuantity,
          availableQuantity: entryData.availableQuantity,
          numberOfLots: entryData.numberOfLots,
          finalQuantity: entryData.finalQuantity,
          unit: entryData.unit,
          productionDate: entryData.productionDate,
          materialRequirements: requirements,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create production batch");
      }

      const batchData = await response.json();
      setBatchNumber(batchData.batchNumber);

      sessionStorage.removeItem("productionEntry");
      sessionStorage.removeItem("materialRequirements");

      toast({
        title: "Production Batch Confirmed",
        description: `Batch ${batchData.batchNumber} has been created and is ready for packaging.`,
      });

      setShowConfirmDialog(false);
      router.push("/production");
    } catch (error) {
      console.error("Error creating production batch:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create production batch. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/production/stock-check">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="page-title">Batch Summary & Confirmation</h1>
              <p className="text-muted-foreground mt-1">
                Step 3: Review and confirm production batch
              </p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center">
              <CheckCircle className="h-4 w-4" />
            </div>
            <span className={isMobile ? "sr-only" : "text-sm text-muted-foreground"}>
              Entry
            </span>
          </div>
          <div className="h-px w-8 bg-primary" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center">
              <CheckCircle className="h-4 w-4" />
            </div>
            <span className={isMobile ? "sr-only" : "text-sm text-muted-foreground"}>
              Stock Check
            </span>
          </div>
          <div className="h-px w-8 bg-primary" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              3
            </div>
            <span className={isMobile ? "sr-only" : "text-sm font-medium"}>
              Confirm
            </span>
          </div>
        </div>

        {/* Batch Summary */}
        <Card className="border-primary/20">
          <CardHeader className="bg-primary/5">
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              Batch Summary
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div className="col-span-2 md:col-span-3">
                <p className="text-sm text-muted-foreground">Batch Number</p>
                <p className="text-2xl font-bold text-primary font-mono">
                  {batchNumber}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Masala</p>
                <p className="font-semibold">{entryData.formulationName}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Planned Production</p>
                <p className="font-semibold">
                  {entryData.plannedQuantity} {entryData.unit} × {entryData.numberOfLots} lots = {entryData.producedQuantity} {entryData.unit}
                </p>
              </div>
              {entryData.availableQuantity > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Available Quantity</p>
                  <p className="font-semibold">
                    {entryData.availableQuantity} {entryData.unit}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Final Total</p>
                <p className="font-semibold">
                  {entryData.finalQuantity} {entryData.unit}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Production Date</p>
                <p className="font-semibold">
                  {new Date(entryData.productionDate).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge className="bg-amber-100 text-black dark:bg-amber-900/30 dark:text-black mt-1">
                  Ready for Packaging
                </Badge>
              </div>
            </div>

            <div className="border-t mt-6 pt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard icon={Package} label="Total Raw Material">
                {summary.totalRawMaterialConsumed.toFixed(2)} {entryData.unit}
              </SummaryCard>

              <SummaryCard icon={Factory} label="Final Output">
                {summary.finalOutputQuantity.toFixed(2)} {entryData.unit}
              </SummaryCard>

              <SummaryCard icon={IndianRupee} label="Production Cost">
                {formatCurrency(summary.totalProductionCost)}
              </SummaryCard>

              <SummaryCard icon={IndianRupee} label="Cost per kg">
                {formatCurrency(summary.costPerKg)}
              </SummaryCard>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between gap-3">
          <Button variant="outline" asChild>
            <Link href="/production/stock-check">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <Button 
            onClick={() => setShowConfirmDialog(true)} 
            className="gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Confirm Production
              </>
            )}
          </Button>
        </div>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={(open) => !isSubmitting && setShowConfirmDialog(open)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Production Batch?</AlertDialogTitle>
              <AlertDialogDescription>
                This will use{" "}
                {summary.totalRawMaterialConsumed.toFixed(2)} {entryData.unit} of
                raw materials and create batch{" "}
                <strong>{batchNumber}</strong>.
                <br />
                <br />
                Production will proceed regardless of current stock levels. Negative quantities may be recorded if materials are insufficient.
                <br />
                <br />
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Confirm"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  children,
}: {
  icon: any;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-muted/50">
      <CardContent className="p-4 text-center">
        <Icon className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{children}</p>
      </CardContent>
    </Card>
  );
}
