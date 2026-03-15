"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Package, ArrowLeft, AlertTriangle, CheckCircle2,
  Loader2, Tag, Info, XCircle,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/libs/utils";
import { useToast } from "@/hooks/use-toast";
import { getStatusColor } from "@/data/packagingData";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductLabel {
  type: string;
  quantity: number; // qty per courier box
  semiPackageable: boolean;
}

interface Product {
  id: string;
  name: string;
  formulationId: string;
  quantity: number;
  unit: "kg" | "gm";
  availableInventory: number;
  labels: ProductLabel[];
}

interface InventoryLabel {
  id: string;
  name: string;
  availableStock: number;
  minimumStock: number;
  status: "active" | "inactive";
}

type StockStatus = "ok" | "low" | "out" | "unknown";

interface LabelBoxEntry {
  type: string;
  qtyPerBox: number;
  packets: number;
  boxes: number;
  weightKg: number;
  availableStock: number;
  stockStatus: StockStatus;
  isCourierBox: boolean; // true if label name contains "courier box"
}

interface PackagingBatch {
  batchNumber: string;
  productName: string;
  formulationId: string;
  producedQuantity: number;
  alreadyPackaged: number;
  totalLoss: number;
  remainingQuantity: number;
  status: "Not Started" | "Partial" | "Completed";
  sessions: any[];
}

const WEIGHT_TOLERANCE = 0.01;

const isCourierBoxLabel = (name: string) =>
  name.toLowerCase().includes("courier box");

// ─── Component ────────────────────────────────────────────────────────────────

export default function PackagingEntry() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const batchNumber = params.id;
  const { toast } = useToast();

  // ─── State ────────────────────────────────────────────────────────────────

  const [batch, setBatch] = useState<PackagingBatch | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryLabels, setInventoryLabels] = useState<InventoryLabel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [labelEntries, setLabelEntries] = useState<LabelBoxEntry[]>([]);
  const [semiPackageableToggles, setSemiPackageableToggles] = useState<Record<string, boolean>>({});

  const [packagingLoss, setPackagingLoss] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const toggleSemiPackageable = (type: string) => {
    setSemiPackageableToggles(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  // ─── Fetch batch + products + label inventory in parallel ─────────────────

  useEffect(() => {
    const fetchData = async () => {
      if (!batchNumber) return;
      try {
        setIsLoading(true);
        setError(null);

        const [batchRes, labelsRes] = await Promise.all([
          fetch(`/api/packaging/batches/${encodeURIComponent(batchNumber as string)}`),
          fetch("/api/labels"),
        ]);

        if (!batchRes.ok)
          throw new Error(
            batchRes.status === 404 ? "Batch not found" : "Failed to fetch batch details"
          );

        const batchData: PackagingBatch = await batchRes.json();
        if (batchData.status === "Completed") {
          router.push("/packaging");
          return;
        }

        const productsRes = await fetch(
          `/api/formulations/${batchData.formulationId}/products/packaging`
        );
        if (!productsRes.ok) throw new Error("Failed to fetch formulation products");

        const [productsData, labelsData] = await Promise.all([
          productsRes.json(),
          labelsRes.ok ? labelsRes.json() : Promise.resolve([]),
        ]);

        setBatch(batchData);
        setProducts(productsData);
        setInventoryLabels(labelsData);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load packaging entry data";
        setError(message);
        toast({ title: "Error", description: message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [batchNumber, router, toast]);

  // ─── Stock lookup helper ──────────────────────────────────────────────────

  const lookupStock = (
    labelName: string,
    requiredQty = 0
  ): { availableStock: number; stockStatus: StockStatus } => {
    const found = inventoryLabels.find(
      (l) => l.name.toLowerCase() === labelName.toLowerCase().trim()
    );
    if (!found) return { availableStock: 0, stockStatus: "unknown" };
    const { availableStock, minimumStock } = found;
    if (availableStock === 0) return { availableStock: 0, stockStatus: "out" };
    if (requiredQty > availableStock) return { availableStock, stockStatus: "out" };
    if (availableStock <= minimumStock) return { availableStock, stockStatus: "low" };
    return { availableStock, stockStatus: "ok" };
  };

  // ─── When product selected, init label entries ────────────────────────────

  useEffect(() => {
    if (!selectedProductId) {
      setLabelEntries([]);
      return;
    }
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    setLabelEntries(
      product.labels.map((pl) => {
        const { availableStock, stockStatus } = lookupStock(pl.type);
        return {
          type: pl.type,
          qtyPerBox: pl.quantity,
          packets: 0,
          boxes: 0,
          weightKg: 0,
          availableStock,
          stockStatus,
          isCourierBox: isCourierBoxLabel(pl.type),
        };
      })
    );

    // Initialize semiPackageable toggles
    const initialToggles: Record<string, boolean> = {};
    product.labels.forEach((pl) => {
      if (pl.semiPackageable) {
        initialToggles[pl.type] = false;
      }
    });
    setSemiPackageableToggles(initialToggles);
  }, [selectedProductId, products, inventoryLabels]);

  // ─── Derived calculations ─────────────────────────────────────────────────

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  const weightPerPacketKg = useMemo(() => {
    if (!selectedProduct) return 0;
    return selectedProduct.unit === "kg"
      ? selectedProduct.quantity
      : selectedProduct.quantity / 1000;
  }, [selectedProduct]);

  // Only non-courier-box labels contribute to packaged weight
  const totalPackets = useMemo(
    () => labelEntries
      .filter((e) => !e.isCourierBox)
      .reduce((sum, e) => sum + e.packets, 0),
    [labelEntries]
  );

  const totalPackagedWeightKg = useMemo(
    () => labelEntries
      .filter((e) => !e.isCourierBox)
      .reduce((sum, e) => sum + e.weightKg, 0),
    [labelEntries]
  );

  const lossValue = parseFloat(packagingLoss) || 0;

  const isExactMatch = batch
    ? Math.abs(totalPackagedWeightKg - batch.remainingQuantity) <= WEIGHT_TOLERANCE
    : false;

  const exceedsRemaining = batch
    ? totalPackagedWeightKg > batch.remainingQuantity + WEIGHT_TOLERANCE
    : false;

  const labelStockErrors = labelEntries.filter(
    (e) => e.packets > 0 && e.stockStatus === "out"
  );

  const hasStockErrors = labelStockErrors.length > 0;

  // ─── Packet entry handler (real-time stock check) ─────────────────────────

  const updatePackets = (type: string, packetsStr: string) => {
    const packets = Math.max(0, parseInt(packetsStr) || 0);
    setLabelEntries((prev) =>
      prev.map((entry) => {
        if (entry.type !== type) return entry;
        // For courier box labels: boxes = packets (1 packet = 1 box)
        // For regular labels: boxes = ceil(packets / qtyPerBox)
        const boxes = entry.isCourierBox
          ? packets
          : packets > 0
            ? Math.ceil(packets / entry.qtyPerBox)
            : 0;
        // Courier box labels don't contribute to weight
        const weightKg = entry.isCourierBox ? 0 : packets * weightPerPacketKg;
        const { availableStock, stockStatus } = lookupStock(type, packets);
        return { ...entry, packets, boxes, weightKg, availableStock, stockStatus };
      })
    );
  };

  // ─── Build payload ────────────────────────────────────────────────────────

  const buildPayload = () => {
    // Regular (non-courier-box) label entries for product inventory update
    const regularEntries = labelEntries.filter((e) => !e.isCourierBox && e.packets > 0);
    // Courier box entry (if any)
    const courierEntry = labelEntries.find((e) => e.isCourierBox && e.packets > 0);

    return {
      items: selectedProduct
        ? regularEntries.map((e) => ({
            containerId: selectedProduct.id,
            numberOfPackets: e.packets,
            totalWeight: e.weightKg,
          }))
        : [],
      labels: labelEntries
        .filter((e) => e.packets > 0)
        .map((e) => ({ type: e.type, quantity: e.packets })),
      // Populate CourierBox DB record automatically from the courier box label entry
      courierBox: courierEntry
        ? {
            label: courierEntry.type,
            itemsPerBox: courierEntry.qtyPerBox,
            boxesNeeded: courierEntry.packets,
            totalPackets,
          }
        : undefined,
      packagingLoss: lossValue,
      remarks: remarks || undefined,
    };
  };

  // ─── Save partial ─────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (totalPackagedWeightKg <= 0) {
      toast({ title: "Nothing to save", description: "Please enter packet quantities before saving.", variant: "destructive" });
      return;
    }
    if (exceedsRemaining) {
      toast({ title: "Exceeds remaining quantity", description: `Total (${totalPackagedWeightKg.toFixed(3)} kg) exceeds remaining (${batch!.remainingQuantity.toFixed(3)} kg).`, variant: "destructive" });
      return;
    }
    if (hasStockErrors) {
      toast({ title: "Insufficient Stock", description: "Some labels don't have enough stock. Please restock before saving.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/packaging/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchNumber: batch!.batchNumber,
          date: new Date().toISOString(),
          ...buildPayload(),
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "Failed to save packaging session");
      }
      toast({ title: "Packaging Saved", description: `Recorded ${totalPackagedWeightKg.toFixed(3)} kg.` });
      router.push(`/packaging/${encodeURIComponent(batch!.batchNumber)}/summary`);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Mark as finished ─────────────────────────────────────────────────────

  const handleFinishBatch = async () => {
    if (hasStockErrors) {
      toast({ title: "Insufficient Stock", description: "Some labels don't have enough stock. Please restock before finishing.", variant: "destructive" });
      return;
    }
    setIsFinishing(true);
    try {
      const response = await fetch(
        `/api/packaging/batches/${encodeURIComponent(batch!.batchNumber)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...buildPayload(),
            remarks: remarks || `Batch marked as finished. Remaining ${batch!.remainingQuantity.toFixed(3)} kg counted as loss.`,
          }),
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "Failed to mark batch as finished");
      }
      toast({ title: "Batch Finished", description: "Batch marked as finished and label stock deducted." });
      router.push(`/packaging/${encodeURIComponent(batch!.batchNumber)}/summary`);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to finish batch.", variant: "destructive" });
    } finally {
      setIsFinishing(false);
    }
  };

  // ─── Loading / Error ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading packaging entry...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!batch || error) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <Package className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Batch Not Found</h2>
          <p className="text-muted-foreground mb-4">{error || "The requested batch could not be found."}</p>
          <Button onClick={() => router.push("/packaging")}>Back to Packaging</Button>
        </div>
      </AppLayout>
    );
  }

  const validLabels = labelEntries.filter((e) => e.packets > 0);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/packaging")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Packaging Entry</h1>
            <p className="text-sm text-muted-foreground">Record packaging for {batch.productName}</p>
          </div>
        </div>

        {/* Batch Summary */}
        <Card>
          <CardHeader className="pb-3 flex-row justify-between items-center">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" />
              Batch Summary
            </CardTitle>
            <Badge className={getStatusColor(batch.status)}>{batch.status}</Badge>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Product</p>
              <p className="font-semibold text-sm">{batch.productName}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Batch</p>
              <p className="font-semibold text-sm">{batch.batchNumber}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Produced</p>
              <p className="font-semibold text-sm">{batch.producedQuantity} kg</p>
            </div>
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <p className="text-xs text-primary">Remaining</p>
              <p className="font-semibold text-primary">{batch.remainingQuantity} kg</p>
            </div>
          </CardContent>
        </Card>

        {/* Product Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Product</CardTitle>
            <p className="text-sm text-muted-foreground">
              Labels and calculations are driven by the selected product's definition
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Product *</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Select a product to package" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} — {product.quantity}{product.unit}
                      {product.labels.length > 0
                        ? ` (${product.labels.map((l) => `${l.type} ×${l.quantity}/box`).join(", ")})`
                        : " (no labels defined)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedProduct && selectedProduct.labels.length === 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 mt-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    This product has no labels defined. Go to{" "}
                    <span className="font-medium">Formulations → Products</span> to add labels before packaging.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Label Quantities — all labels including courier box */}
        {selectedProduct && selectedProduct.labels.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tag className="h-5 w-5 text-primary" />
                Label Quantities
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter packet quantities for each label. Boxes are auto-calculated.
                Labels named "courier box" track box inventory separately.
              </p>
            </CardHeader>
            <CardContent>

              {/* Column headers */}
              <div className="hidden md:grid grid-cols-12 gap-3 px-2 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <div className="col-span-3">Label Type</div>
                <div className="col-span-2 text-center">Per Box</div>
                <div className="col-span-2 text-center">Packets</div>
                <div className="col-span-2 text-center">Boxes</div>
                <div className="col-span-3 text-center">Weight (kg)</div>
              </div>

              <div className="space-y-3">
                {labelEntries.map((entry) => {
                  const isError = entry.packets > 0 && entry.stockStatus === "out";
                  const isLow = entry.packets > 0 && entry.stockStatus === "low";

                  return (
                    <div
                      key={entry.type}
                      className={cn(
                        "grid grid-cols-2 md:grid-cols-12 gap-3 items-start p-4 border rounded-lg bg-muted/20",
                        entry.packets > 0 && !isError && !isLow && "border-primary/30 bg-primary/5",
                        isError && "border-destructive/50 bg-destructive/5",
                        isLow && "border-amber-400/50 bg-amber-50/50 dark:bg-amber-900/10",
                      )}
                    >
                      {/* Label name + stock indicator */}
                      <div className="col-span-2 md:col-span-3 flex items-start gap-2">
                        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-sm">{entry.type}</p>
                            {entry.isCourierBox && (
                              <span className="text-[10px] font-medium bg-muted text-muted-foreground rounded px-1.5 py-0.5 uppercase tracking-wide">
                                Box
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {entry.isCourierBox
                              ? `${entry.qtyPerBox} pcs/box · tracks box stock`
                              : `${entry.qtyPerBox} pcs/box`}
                          </p>
                          {/* Live stock status */}
                          {entry.stockStatus === "unknown" && (
                            <p className="text-xs text-muted-foreground mt-0.5">Not in inventory</p>
                          )}
                          {entry.stockStatus === "ok" && (
                            <p className="text-xs text-success mt-0.5 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {entry.availableStock.toLocaleString("en-IN")} in stock
                            </p>
                          )}
                          {entry.stockStatus === "low" && (
                            <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Low — {entry.availableStock.toLocaleString("en-IN")} left
                            </p>
                          )}
                          {entry.stockStatus === "out" && (
                            <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              {entry.availableStock === 0
                                ? "Out of stock"
                                : `Only ${entry.availableStock.toLocaleString("en-IN")} available`}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Per box chip */}
                      <div className="hidden md:flex md:col-span-2 justify-center items-center">
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                          {entry.qtyPerBox} pcs
                        </span>
                      </div>

                      {/* Packets input */}
                      <div className="col-span-1 md:col-span-2">
                        <Label className="text-xs text-muted-foreground md:hidden mb-1 block">
                          {entry.isCourierBox ? "Boxes" : "Packets"}
                        </Label>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            value={entry.packets || ""}
                            onChange={(e) => updatePackets(entry.type, e.target.value)}
                            placeholder="0"
                            className={cn(
                              "pr-10 text-center",
                              isError && "border-destructive focus-visible:ring-destructive"
                            )}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {entry.isCourierBox ? "box" : "pcs"}
                          </span>
                        </div>
                      </div>

                      {/* Auto boxes (hidden for courier box — user enters boxes directly) */}
                      <div className="col-span-1 md:col-span-2">
                        <Label className="text-xs text-muted-foreground md:hidden mb-1 block">Boxes</Label>
                        <div className="flex items-center justify-center h-10 px-3 rounded-md border bg-muted/50 text-sm font-medium">
                          {entry.isCourierBox
                            ? (entry.packets > 0 ? entry.packets.toLocaleString("en-IN") : "—")
                            : (entry.boxes > 0 ? entry.boxes.toLocaleString("en-IN") : "—")}
                        </div>
                      </div>

                      {/* Weight — courier box shows "—" since it doesn't contribute to weight */}
                      <div className="col-span-2 md:col-span-3">
                        <Label className="text-xs text-muted-foreground md:hidden mb-1 block">Weight (kg)</Label>
                        <div className={cn(
                          "flex items-center justify-center h-10 px-3 rounded-md border text-sm font-semibold",
                          entry.isCourierBox
                            ? "bg-muted/50 text-muted-foreground"
                            : isError
                              ? "bg-destructive/10 border-destructive/30 text-destructive"
                              : entry.weightKg > 0
                                ? "bg-primary/10 border-primary/30 text-primary"
                                : "bg-muted/50 text-muted-foreground"
                        )}>
                          {entry.isCourierBox
                            ? "—"
                            : entry.weightKg > 0
                              ? `${entry.weightKg.toFixed(3)} kg`
                              : "—"}
                        </div>
                      </div>
                      

                      {/* Semi-packageable toggle - only shown if label is semi-packageable */}
                      {selectedProduct?.labels.find((pl) => pl.type === entry.type && pl.semiPackageable) && (
                        <div className="col-span-1 md:col-span-2 flex items-center justify-center">
                          <div className="flex items-center space-x-2">
                            <Label htmlFor={`semi-packageable-${entry.type}`} className="text-xs text-muted-foreground">
                              Semi-packageable
                            </Label>
                            <Switch
                              id={`semi-packageable-${entry.type}`}
                              checked={semiPackageableToggles[entry.type] || false}
                              onCheckedChange={(checked) => toggleSemiPackageable(entry.type)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Stock error banner */}
              {labelStockErrors.length > 0 && (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive text-sm">Insufficient label stock</p>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {labelStockErrors.map((e) => (
                        <p key={e.type}>
                          • {e.type}: need {e.packets.toLocaleString("en-IN")} {e.isCourierBox ? "boxes" : "pcs"},{" "}
                          {e.availableStock === 0 ? "none" : `only ${e.availableStock.toLocaleString("en-IN")}`} available
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Weight summary bar */}
              {totalPackagedWeightKg > 0 && (
                <div className={cn(
                  "mt-4 rounded-lg p-4 flex items-center justify-between",
                  exceedsRemaining
                    ? "bg-destructive/10 border border-destructive/30"
                    : isExactMatch
                      ? "bg-success/10 border border-success/30"
                      : "bg-muted/50 border border-border"
                )}>
                  <div className="flex items-center gap-2">
                    {exceedsRemaining ? (
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    ) : isExactMatch ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Info className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {exceedsRemaining
                          ? "Exceeds remaining quantity"
                          : isExactMatch
                            ? "Exact match — ready to finish"
                            : "Partial packaging"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {exceedsRemaining
                          ? `Reduce packets — max ${batch.remainingQuantity.toFixed(3)} kg remaining`
                          : isExactMatch
                            ? "Total weight matches remaining quantity"
                            : `${(batch.remainingQuantity - totalPackagedWeightKg).toFixed(3)} kg still unpackaged`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total weight</p>
                    <p className={cn(
                      "text-lg font-bold",
                      exceedsRemaining ? "text-destructive" : isExactMatch ? "text-success" : "text-foreground"
                    )}>
                      {totalPackagedWeightKg.toFixed(3)} kg
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loss & Remarks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Loss & Remarks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Packaging Loss (kg)</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={packagingLoss}
                onChange={(e) => setPackagingLoss(e.target.value)}
                placeholder="0.000"
              />
            </div>
            <div className="space-y-1">
              <Label>Remarks</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any notes about this packaging session..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Session Summary + Actions */}
        <Card className={cn(
          hasStockErrors && "border-destructive",
          !hasStockErrors && exceedsRemaining && "border-destructive",
          !hasStockErrors && !exceedsRemaining && isExactMatch && totalPackagedWeightKg > 0 && "border-success/50",
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {hasStockErrors ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : isExactMatch && totalPackagedWeightKg > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : exceedsRemaining ? (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              ) : null}
              Session Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-muted/50 p-3 text-center rounded-lg">
                <p className="text-xs text-muted-foreground">Total Packets</p>
                <p className="font-semibold">{totalPackets.toLocaleString("en-IN")}</p>
              </div>
              <div className="bg-muted/50 p-3 text-center rounded-lg">
                <p className="text-xs text-muted-foreground">Packaged</p>
                <p className="font-semibold">{totalPackagedWeightKg.toFixed(3)} kg</p>
              </div>
              <div className="bg-amber-100 dark:bg-amber-900/30 p-3 text-center rounded-lg">
                <p className="text-xs">Loss</p>
                <p className="font-semibold">{lossValue.toFixed(3)} kg</p>
              </div>
              <div className="bg-primary/10 p-3 text-center rounded-lg">
                <p className="text-xs text-primary">Remaining After</p>
                <p className="font-semibold text-primary">
                  {batch ? Math.max(0, batch.remainingQuantity - totalPackagedWeightKg).toFixed(3) : "0.000"} kg
                </p>
              </div>
            </div>

            {/* Label summary badges */}
            {validLabels.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {validLabels.map((l) => (
                  <Badge
                    key={l.type}
                    variant="secondary"
                    className={cn(
                      l.stockStatus === "out" && "border-destructive/50 bg-destructive/10 text-destructive",
                      l.stockStatus === "low" && "border-amber-400/50 bg-amber-50 text-amber-700 dark:bg-amber-900/20",
                    )}
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {l.isCourierBox
                      ? `${l.type}: ${l.packets.toLocaleString("en-IN")} boxes`
                      : `${l.type}: ${l.packets.toLocaleString("en-IN")} pcs (${l.boxes} boxes)`}
                    {l.stockStatus === "out" && <XCircle className="h-3 w-3 ml-1" />}
                    {l.stockStatus === "low" && <AlertTriangle className="h-3 w-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            )}

            {/* Global stock error */}
            {hasStockErrors && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive text-sm">Cannot proceed — insufficient stock</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please go to Labels Inventory and restock the items above before saving or finishing.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">

              {/* Save Partial */}
              {!isExactMatch && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={totalPackagedWeightKg <= 0 || exceedsRemaining || isSubmitting || isFinishing || hasStockErrors}
                      className="flex-1"
                    >
                      Save Packaging (Partial)
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Save Partial Packaging</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will record {totalPackagedWeightKg.toFixed(3)} kg as packaged.{" "}
                        {(batch.remainingQuantity - totalPackagedWeightKg).toFixed(3)} kg will remain for future sessions.
                        Label stock will be deducted when the batch is marked as finished.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSubmit}>Save</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* Mark as Finished */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={exceedsRemaining || isSubmitting || isFinishing || batch.remainingQuantity <= 0 || hasStockErrors}
                    className={cn(
                      "flex-1",
                      isExactMatch && totalPackagedWeightKg > 0 && !hasStockErrors
                        ? "bg-success hover:bg-success/90"
                        : ""
                    )}
                  >
                    {isFinishing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Finishing...</>
                    ) : isExactMatch && totalPackagedWeightKg > 0 ? (
                      <><CheckCircle2 className="h-4 w-4 mr-2" /> Mark as Finished</>
                    ) : (
                      "Mark as Finished (with remaining as loss)"
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark Batch as Finished</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isExactMatch && totalPackagedWeightKg > 0 ? (
                        <>All {batch.remainingQuantity.toFixed(3)} kg will be recorded as packaged.</>
                      ) : (
                        <>
                          {totalPackagedWeightKg > 0
                            ? `${totalPackagedWeightKg.toFixed(3)} kg will be packaged and `
                            : ""}
                          {Math.max(0, batch.remainingQuantity - totalPackagedWeightKg).toFixed(3)} kg will be counted as loss.
                        </>
                      )}
                      {validLabels.length > 0 && (
                        <>
                          <br /><br />
                          <strong>Label stock will be deducted:</strong>
                          <br />
                          {validLabels.map((l) => (
                            <span key={l.type} className="block">
                              {l.isCourierBox
                                ? `• ${l.type}: ${l.packets.toLocaleString("en-IN")} boxes`
                                : `• ${l.type}: ${l.packets.toLocaleString("en-IN")} pcs (${l.boxes} boxes)`}
                            </span>
                          ))}
                        </>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleFinishBatch}
                      className={isExactMatch ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
                    >
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

            </div>
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}