"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Package, ArrowLeft, AlertTriangle, CheckCircle2,
  Loader2, Tag, Info, XCircle, RefreshCw, Box,
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
  quantity: number;       // qty per master carton
  boxTypeId?: string;     // linked box type from box inventory
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

interface BoxType {
  id: string;
  name: string;
  availableStock: number;
  minimumStock: number;
  status: string;
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
  isCourierBox: boolean;
  // Box type linked to this label
  boxTypeId?: string;
  boxTypeName?: string;
  boxTypeStock: number;
  boxTypeMinStock: number;
  boxTypeStockStatus: StockStatus;
}

interface PackagingBatch {
  batchNumber: string;
  productName: string;
  formulationId: string;
  producedQuantity: number;
  alreadyPackaged: number;
  totalLoss: number;
  remainingQuantity: number;
  status: "Not Started" | "Partial" | "Semi Packaged" | "Completed";
  sessions: any[];
  semiPackaged: number;
  semiPackagedLabels: Array<{ type: string; quantity: number }>;
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
  const [boxTypesMap, setBoxTypesMap] = useState<Map<string, BoxType>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [labelEntries, setLabelEntries] = useState<LabelBoxEntry[]>([]);
  const [semiToggles, setSemiToggles] = useState<Record<string, boolean>>({});

  const [packagingLoss, setPackagingLoss] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // ─── Fetch batch + products + label inventory + box types ─────────────────

  useEffect(() => {
    const fetchData = async () => {
      if (!batchNumber) return;
      try {
        setIsLoading(true);
        setError(null);

        const [batchRes, labelsRes, boxTypesRes] = await Promise.all([
          fetch(`/api/packaging/batches/${encodeURIComponent(batchNumber as string)}`),
          fetch("/api/labels"),
          fetch("/api/box-inventory"),
        ]);

        if (!batchRes.ok)
          throw new Error(
            batchRes.status === 404 ? "Batch not found" : "Failed to fetch batch details"
          );

        const batchData: PackagingBatch = await batchRes.json();
        if (batchData.status === "Completed" && (batchData.semiPackaged ?? 0) <= 0) {
          router.push("/packaging");
          return;
        }

        // Build a map of boxTypeId → BoxType for quick lookups
        if (boxTypesRes.ok) {
          const boxTypesData: BoxType[] = await boxTypesRes.json();
          const map = new Map<string, BoxType>();
          boxTypesData.forEach((b) => map.set(b.id, b));
          setBoxTypesMap(map);
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
        const message =
          err instanceof Error ? err.message : "Failed to load packaging entry data";
        setError(message);
        toast({ title: "Error", description: message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [batchNumber, router, toast]);

  // ─── Stock lookup helpers ─────────────────────────────────────────────────

  const lookupLabelStock = (
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

  // Lookup box type stock by ID and required box count
  const lookupBoxTypeStock = (
    boxTypeId: string | undefined,
    requiredBoxes = 0
  ): { boxTypeStock: number; boxTypeMinStock: number; boxTypeStockStatus: StockStatus } => {
    if (!boxTypeId) return { boxTypeStock: 0, boxTypeMinStock: 0, boxTypeStockStatus: "unknown" };
    const found = boxTypesMap.get(boxTypeId);
    if (!found) return { boxTypeStock: 0, boxTypeMinStock: 0, boxTypeStockStatus: "unknown" };
    const { availableStock, minimumStock } = found;
    if (availableStock === 0) return { boxTypeStock: 0, boxTypeMinStock: minimumStock, boxTypeStockStatus: "out" };
    if (requiredBoxes > availableStock) return { boxTypeStock: availableStock, boxTypeMinStock: minimumStock, boxTypeStockStatus: "out" };
    if (availableStock <= minimumStock) return { boxTypeStock: availableStock, boxTypeMinStock: minimumStock, boxTypeStockStatus: "low" };
    return { boxTypeStock: availableStock, boxTypeMinStock: minimumStock, boxTypeStockStatus: "ok" };
  };

  // ─── Helper: semi-packaged qty for a label type ───────────────────────────

  const getSemiPackagedQty = (type: string): number => {
    if (!batch?.semiPackagedLabels) return 0;
    return batch.semiPackagedLabels.find((l) => l.type === type)?.quantity ?? 0;
  };

  const isToggleLocked = (type: string): boolean => {
    const isSemiPackageable = !!selectedProduct?.labels.find(
      (pl) => pl.type === type && pl.semiPackageable
    );
    if (!isSemiPackageable) return false;
    return getSemiPackagedQty(type) === 0;
  };

  // ─── When product selected, init label entries + toggles ─────────────────

  useEffect(() => {
    if (!selectedProductId || !batch) {
      setLabelEntries([]);
      return;
    }
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    setLabelEntries(
      product.labels.map((pl) => {
        const { availableStock, stockStatus } = lookupLabelStock(pl.type);
        const { boxTypeStock, boxTypeMinStock, boxTypeStockStatus } = lookupBoxTypeStock(pl.boxTypeId);
        const boxType = pl.boxTypeId ? boxTypesMap.get(pl.boxTypeId) : undefined;
        return {
          type: pl.type,
          qtyPerBox: pl.quantity,
          packets: 0,
          boxes: 0,
          weightKg: 0,
          availableStock,
          stockStatus,
          isCourierBox: isCourierBoxLabel(pl.type),
          boxTypeId: pl.boxTypeId,
          boxTypeName: boxType?.name,
          boxTypeStock,
          boxTypeMinStock,
          boxTypeStockStatus,
        };
      })
    );

    const initialToggles: Record<string, boolean> = {};
    product.labels.forEach((pl) => {
      if (pl.semiPackageable) {
        const hasPreviousSemi = (batch.semiPackagedLabels ?? []).some(
          (sl) => sl.type === pl.type && sl.quantity > 0
        );
        initialToggles[pl.type] = !hasPreviousSemi;
      }
    });
    setSemiToggles(initialToggles);
  }, [selectedProductId, products, inventoryLabels, batch, boxTypesMap]);

  // ─── Derived values ───────────────────────────────────────────────────────

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

  const currentSessionSemiWeightKg = useMemo(
    () =>
      labelEntries
        .filter((e) => !e.isCourierBox && semiToggles[e.type] === true)
        .reduce((sum, e) => sum + e.weightKg, 0),
    [labelEntries, semiToggles]
  );

  const totalNewPackagedWeightKg = useMemo(
    () =>
      labelEntries
        .filter((e) => !e.isCourierBox && semiToggles[e.type] !== true)
        .reduce((sum, e) => sum + e.weightKg, 0),
    [labelEntries, semiToggles]
  );

  const totalNewPackets = useMemo(
    () =>
      labelEntries
        .filter((e) => !e.isCourierBox && semiToggles[e.type] !== true)
        .reduce((sum, e) => sum + e.packets, 0),
    [labelEntries, semiToggles]
  );

  const lossValue = parseFloat(packagingLoss) || 0;

  const conversionWeightKg = useMemo(
    () =>
      labelEntries
        .filter((e) => {
          if (e.isCourierBox) return false;
          const isSemiPackageable = !!selectedProduct?.labels.find(
            (pl) => pl.type === e.type && pl.semiPackageable
          );
          return isSemiPackageable && semiToggles[e.type] === false && e.packets > 0;
        })
        .reduce((sum, e) => sum + e.weightKg, 0),
    [labelEntries, semiToggles, selectedProduct]
  );

  const newWeightKg = totalNewPackagedWeightKg - conversionWeightKg;

  const isExactMatch = batch
    ? Math.abs((newWeightKg + currentSessionSemiWeightKg) - batch.remainingQuantity) <= WEIGHT_TOLERANCE
    : false;

  const exceedsRemaining = batch
    ? (newWeightKg + currentSessionSemiWeightKg) > batch.remainingQuantity + WEIGHT_TOLERANCE
    : false;

  const totalBoxesNeeded = useMemo(
    () => labelEntries
      .filter((e) => !e.isCourierBox && semiToggles[e.type] !== true && e.boxes > 0)
      .reduce((sum, e) => sum + e.boxes, 0),
    [labelEntries, semiToggles]
  );

  // Label stock errors (fully-packaged entries only)
  const labelStockErrors = labelEntries.filter((e) => {
    if (e.isCourierBox || semiToggles[e.type] === true) return false;
    return e.packets > 0 && e.stockStatus === "out";
  });

  // Box type stock errors (fully-packaged entries with a linked box type)
  const boxTypeStockErrors = labelEntries.filter((e) => {
    if (e.isCourierBox || semiToggles[e.type] === true) return false;
    if (!e.boxTypeId || e.boxes === 0) return false;
    return e.boxTypeStockStatus === "out";
  });

  const hasStockErrors = labelStockErrors.length > 0;

  // ─── Packet update handler ────────────────────────────────────────────────

  const updatePackets = (type: string, packetsStr: string) => {
    const semiQty = getSemiPackagedQty(type);
    const isConversionMode = semiToggles[type] === false;

    let packets = Math.max(0, parseInt(packetsStr) || 0);
    if (isConversionMode && semiQty > 0) {
      packets = Math.min(packets, semiQty);
    }

    setLabelEntries((prev) =>
      prev.map((entry) => {
        if (entry.type !== type) return entry;
        const boxes = entry.isCourierBox
          ? packets
          : packets > 0
            ? Math.ceil(packets / entry.qtyPerBox)
            : 0;
        const weightKg = entry.isCourierBox ? 0 : packets * weightPerPacketKg;
        const needsStockCheck = semiToggles[type] !== true;
        const { availableStock, stockStatus } = needsStockCheck
          ? lookupLabelStock(type, packets)
          : { availableStock: entry.availableStock, stockStatus: entry.stockStatus };
        // Re-evaluate box type stock with new box count
        const { boxTypeStock, boxTypeMinStock, boxTypeStockStatus } = needsStockCheck
          ? lookupBoxTypeStock(entry.boxTypeId, boxes)
          : { boxTypeStock: entry.boxTypeStock, boxTypeMinStock: entry.boxTypeMinStock, boxTypeStockStatus: entry.boxTypeStockStatus };
        return { ...entry, packets, boxes, weightKg, availableStock, stockStatus, boxTypeStock, boxTypeMinStock, boxTypeStockStatus };
      })
    );
  };

  // ─── Toggle handler ───────────────────────────────────────────────────────

  const handleToggle = (type: string) => {
    if (isToggleLocked(type)) return;
    setSemiToggles((prev) => ({ ...prev, [type]: !prev[type] }));
    setLabelEntries((prev) =>
      prev.map((entry) =>
        entry.type === type
          ? { ...entry, packets: 0, boxes: 0, weightKg: 0 }
          : entry
      )
    );
  };

  const handleConvertNow = (type: string) => {
    const semiPackets = labelEntries.find((e) => e.type === type)?.packets ?? 0;
    if (semiPackets === 0) return;
    setSemiToggles((prev) => ({ ...prev, [type]: false }));
    setLabelEntries((prev) =>
      prev.map((entry) => {
        if (entry.type !== type) return entry;
        const boxes = Math.ceil(semiPackets / entry.qtyPerBox);
        const weightKg = semiPackets * weightPerPacketKg;
        const { availableStock, stockStatus } = lookupLabelStock(type, semiPackets);
        const { boxTypeStock, boxTypeMinStock, boxTypeStockStatus } = lookupBoxTypeStock(entry.boxTypeId, boxes);
        return { ...entry, packets: semiPackets, boxes, weightKg, availableStock, stockStatus, boxTypeStock, boxTypeMinStock, boxTypeStockStatus };
      })
    );
  };

  // ─── Build payload ────────────────────────────────────────────────────────

  const buildPayload = () => {
    const courierEntry = labelEntries.find((e) => e.isCourierBox && e.packets > 0);

    const semiEntries = labelEntries.filter(
      (e) => !e.isCourierBox && semiToggles[e.type] === true && e.packets > 0
    );
    const conversionEntries = labelEntries.filter(
      (e) =>
        !e.isCourierBox &&
        semiToggles[e.type] === false &&
        e.packets > 0 &&
        !!selectedProduct?.labels.find((pl) => pl.type === e.type && pl.semiPackageable)
    );
    const regularEntries = labelEntries.filter(
      (e) =>
        !e.isCourierBox &&
        e.packets > 0 &&
        !selectedProduct?.labels.find((pl) => pl.type === e.type && pl.semiPackageable)
    );

    const fullPackagedWeight =
      regularEntries.reduce((s, e) => s + e.weightKg, 0) +
      conversionEntries.reduce((s, e) => s + e.weightKg, 0);
    const fullPackagedPackets =
      regularEntries.reduce((s, e) => s + e.packets, 0) +
      conversionEntries.reduce((s, e) => s + e.packets, 0);
    const semiWeight = semiEntries.reduce((s, e) => s + e.weightKg, 0);
    const semiPackets = semiEntries.reduce((s, e) => s + e.packets, 0);

    const items: any[] = [];
    if (selectedProduct) {
      if (fullPackagedPackets > 0) {
        items.push({
          containerId: selectedProduct.id,
          numberOfPackets: fullPackagedPackets,
          totalWeight: fullPackagedWeight,
        });
      } else if (semiPackets > 0) {
        items.push({
          containerId: selectedProduct.id,
          numberOfPackets: semiPackets,
          totalWeight: semiWeight,
        });
      }
    }

    const labelsPayload = [
      ...regularEntries.map((e) => ({
        type: e.type,
        quantity: e.packets,
        boxTypeId: e.boxTypeId || null,
        boxesUsed: e.boxes,
        semiPackaged: false,
        isConversion: false,
      })),
      ...semiEntries.map((e) => ({
        type: e.type,
        quantity: e.packets,
        boxTypeId: null,        // no box deduction for semi
        boxesUsed: 0,
        semiPackaged: true,
        isConversion: false,
      })),
      ...conversionEntries.map((e) => ({
        type: e.type,
        quantity: e.packets,
        boxTypeId: e.boxTypeId || null,
        boxesUsed: e.boxes,
        semiPackaged: false,
        isConversion: true,
      })),
      ...(courierEntry
        ? [{ type: courierEntry.type, quantity: courierEntry.packets, boxTypeId: null, boxesUsed: 0, semiPackaged: false, isConversion: false }]
        : []),
    ];

    // Box type deductions — one entry per unique boxTypeId used in fully-packaged entries
    const boxTypeDeductions: Array<{ boxTypeId: string; boxesUsed: number }> = [];
    const seen = new Map<string, number>();
    [...regularEntries, ...conversionEntries].forEach((e) => {
      if (e.boxTypeId && e.boxes > 0) {
        seen.set(e.boxTypeId, (seen.get(e.boxTypeId) ?? 0) + e.boxes);
      }
    });
    seen.forEach((boxes, id) => boxTypeDeductions.push({ boxTypeId: id, boxesUsed: boxes }));

    return {
      items,
      labels: labelsPayload,
      boxTypeDeductions,   // ← backend uses this to reduce box inventory
      courierBox: courierEntry
        ? {
          label: courierEntry.type,
          itemsPerBox: courierEntry.qtyPerBox,
          boxesNeeded: courierEntry.packets,
          totalPackets: fullPackagedPackets,
        }
        : undefined,
      packagingLoss: lossValue,
      remarks: remarks || undefined,
      totalBoxes: totalBoxesNeeded,
    };
  };

  // ─── Save partial ─────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const hasAnything = totalNewPackagedWeightKg > 0 || currentSessionSemiWeightKg > 0;
    if (!hasAnything) {
      toast({ title: "Nothing to save", description: "Please enter packet quantities before saving.", variant: "destructive" });
      return;
    }
    if (exceedsRemaining) {
      toast({ title: "Exceeds remaining quantity", description: `Total exceeds remaining (${batch!.remainingQuantity.toFixed(3)} kg).`, variant: "destructive" });
      return;
    }
    if (hasStockErrors) {
      toast({ title: "Insufficient Stock", description: "Some labels don't have enough stock.", variant: "destructive" });
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
      toast({ title: "Packaging Saved", description: `Recorded ${(totalNewPackagedWeightKg + currentSessionSemiWeightKg).toFixed(3)} kg.` });
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
      toast({ title: "Insufficient Stock", description: "Some labels don't have enough stock.", variant: "destructive" });
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
            date: new Date().toISOString(),
            ...buildPayload(),
            remarks: remarks || `Batch marked as finished. Remaining ${batch!.remainingQuantity.toFixed(3)} kg counted as loss.`,
          }),
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "Failed to mark batch as finished");
      }
      toast({ title: "Batch Finished", description: "Batch marked as finished and stock deducted." });
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
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-3 text-center">
              <p className="text-xs text-white-700 dark:text-white-300">Semi-Packaged</p>
              <p className="font-semibold text-sm text-white-700 dark:text-white-300">
                {batch.semiPackaged.toFixed(3)} kg
              </p>
              {batch.semiPackagedLabels && batch.semiPackagedLabels.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 justify-center">
                  {batch.semiPackagedLabels.map((sl) => (
                    <span key={sl.type} className="text-[10px] bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 rounded px-1">
                      {sl.type}: {sl.quantity}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <p className="text-xs text-primary">Remaining</p>
              <p className="font-semibold text-primary text-sm">{Number(batch.remainingQuantity).toFixed(2)} kg</p>
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
                    This product has no labels defined. Go to <span className="font-medium">Formulations → Products</span> to add labels before packaging.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Label Quantities */}
        {selectedProduct && selectedProduct.labels.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tag className="h-5 w-5 text-primary" />
                Label Quantities
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter packet quantities for each label. Boxes and box type stock are auto-tracked.
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
                  const isSemiPackageable = !!selectedProduct?.labels.find(
                    (pl) => pl.type === entry.type && pl.semiPackageable
                  );
                  const semiQty = getSemiPackagedQty(entry.type);
                  const locked = isToggleLocked(entry.type);
                  const isSemiMode = isSemiPackageable && semiToggles[entry.type] === true;
                  const isConversionMode = isSemiPackageable && !semiToggles[entry.type] && semiQty > 0;

                  const isError =
                    !isSemiMode && entry.packets > 0 && entry.stockStatus === "out";
                  const isLow =
                    !isSemiMode && entry.packets > 0 && entry.stockStatus === "low";
                  const isBoxTypeError =
                    !isSemiMode && entry.boxes > 0 && entry.boxTypeId && entry.boxTypeStockStatus === "out";
                  const isBoxTypeLow =
                    !isSemiMode && entry.boxes > 0 && entry.boxTypeId && entry.boxTypeStockStatus === "low";

                  return (
                    <div
                      key={entry.type}
                      className={cn(
                        "border rounded-lg bg-muted/20 overflow-hidden",
                        isSemiMode && entry.packets > 0 && "border-orange-400/50 bg-orange-50/50 dark:bg-orange-900/10",
                        isConversionMode && entry.packets > 0 && "border-primary/30 bg-primary/5",
                        !isSemiMode && !isConversionMode && entry.packets > 0 && !isError && !isLow && !isBoxTypeError && "border-primary/30 bg-primary/5",
                        (isError || isBoxTypeError) && "border-destructive/50 bg-destructive/5",
                        (isLow || isBoxTypeLow) && !isError && !isBoxTypeError && "border-amber-400/50 bg-amber-50/50 dark:bg-amber-900/10",
                      )}
                    >
                      {/* Main row */}
                      <div className="grid grid-cols-2 md:grid-cols-12 gap-3 items-start p-4">

                        {/* Label name + stock info */}
                        <div className="col-span-2 md:col-span-3 flex items-start gap-2">
                          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-medium text-sm">{entry.type}</p>
                              {entry.isCourierBox && (
                                <span className="text-[10px] font-medium bg-muted text-muted-foreground rounded px-1.5 py-0.5 uppercase tracking-wide">Box</span>
                              )}
                              {isSemiMode && (
                                <span className="text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded px-1.5 py-0.5 uppercase tracking-wide">Semi</span>
                              )}
                              {isConversionMode && (
                                <span className="text-[10px] font-medium bg-primary/10 text-primary rounded px-1.5 py-0.5 uppercase tracking-wide">Converting</span>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground">
                              {entry.isCourierBox
                                ? `${entry.qtyPerBox} pcs/box · tracks box stock`
                                : isSemiMode
                                  ? `${entry.qtyPerBox} pcs/box · label stock deferred`
                                  : `${entry.qtyPerBox} pcs/box`}
                            </p>

                            {/* Previous semi count */}
                            {isSemiPackageable && semiQty > 0 && (
                              <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5 flex items-center gap-1">
                                <RefreshCw className="h-3 w-3" />
                                {semiQty} semi-packaged pending
                              </p>
                            )}

                            {/* Label stock (only in fully-packaged mode) */}
                            {!isSemiMode && (
                              <>
                                {entry.stockStatus === "unknown" && (
                                  <p className="text-xs text-muted-foreground mt-0.5">Not in inventory</p>
                                )}
                                {entry.stockStatus === "ok" && (
                                  <p className="text-xs text-success mt-0.5 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    {entry.availableStock.toLocaleString("en-IN")} labels in stock
                                  </p>
                                )}
                                {entry.stockStatus === "low" && (
                                  <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Label low — {entry.availableStock.toLocaleString("en-IN")} left
                                  </p>
                                )}
                                {entry.stockStatus === "out" && (
                                  <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
                                    <XCircle className="h-3 w-3" />
                                    {entry.availableStock === 0
                                      ? "Labels out of stock"
                                      : `Only ${entry.availableStock.toLocaleString("en-IN")} labels available`}
                                  </p>
                                )}
                              </>
                            )}

                            {/* ── Box type stock (only in fully-packaged mode, when linked) ── */}
                            {!isSemiMode && !entry.isCourierBox && entry.boxTypeId && entry.boxTypeName && (
                              <div className="mt-1.5 flex items-start gap-1">
                                <Box className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-xs text-muted-foreground">
                                    Box: <span className="font-medium text-foreground">{entry.boxTypeName}</span>
                                  </p>
                                  {entry.boxes > 0 && (
                                    <>
                                      {entry.boxTypeStockStatus === "ok" && (
                                        <p className="text-xs text-success flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          {entry.boxTypeStock.toLocaleString("en-IN")} boxes in stock
                                        </p>
                                      )}
                                      {entry.boxTypeStockStatus === "low" && (
                                        <p className="text-xs text-amber-600 flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3" />
                                          Box low — {entry.boxTypeStock.toLocaleString("en-IN")} left
                                        </p>
                                      )}
                                      {entry.boxTypeStockStatus === "out" && (
                                        <p className="text-xs text-destructive flex items-center gap-1">
                                          <XCircle className="h-3 w-3" />
                                          {entry.boxTypeStock === 0
                                            ? "Boxes out of stock"
                                            : `Only ${entry.boxTypeStock.toLocaleString("en-IN")} boxes available`}
                                        </p>
                                      )}
                                    </>
                                  )}
                                  {entry.boxes === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      {entry.boxTypeStock.toLocaleString("en-IN")} available
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Per box chip */}
                        <div className="hidden md:flex md:col-span-2 justify-center items-center">
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                            {isSemiMode ? "NA" : `${entry.qtyPerBox} pcs`}
                          </span>
                        </div>

                        {/* Packets input */}
                        <div className="col-span-1 md:col-span-2">
                          <Label className="text-xs text-muted-foreground md:hidden mb-1 block">
                            {entry.isCourierBox ? "Boxes" : isConversionMode ? "Convert" : "Packets"}
                          </Label>
                          <div className="relative">
                            <Input
                              type="number"
                              min="0"
                              max={isConversionMode ? semiQty : undefined}
                              value={entry.packets || ""}
                              onChange={(e) => updatePackets(entry.type, e.target.value)}
                              placeholder="0"
                              className={cn(
                                "pr-10 text-center",
                                (isError || isBoxTypeError) && "border-destructive focus-visible:ring-destructive",
                                isConversionMode && "border-primary/50"
                              )}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              {entry.isCourierBox ? "box" : "pcs"}
                            </span>
                          </div>
                          {isConversionMode && (
                            <p className="text-[10px] text-muted-foreground mt-1 text-center">max {semiQty}</p>
                          )}
                        </div>

                        {/* Boxes */}
                        <div className="col-span-1 md:col-span-2">
                          <Label className="text-xs text-muted-foreground md:hidden mb-1 block">Boxes</Label>
                          <div className="flex items-center justify-center h-10 px-3 rounded-md border bg-muted/50 text-sm font-medium">
                            {isSemiMode
                              ? "NA"
                              : entry.isCourierBox
                                ? entry.packets > 0 ? entry.packets.toLocaleString("en-IN") : "—"
                                : entry.boxes > 0 ? entry.boxes.toLocaleString("en-IN") : "—"}
                          </div>
                          {/* Show box type name under boxes count */}
                          {!isSemiMode && !entry.isCourierBox && entry.boxTypeName && entry.boxes > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 text-center truncate">
                              {entry.boxTypeName}
                            </p>
                          )}
                        </div>

                        {/* Weight */}
                        <div className="col-span-2 md:col-span-3">
                          <Label className="text-xs text-muted-foreground md:hidden mb-1 block">Weight (kg)</Label>
                          <div className={cn(
                            "flex items-center justify-center h-10 px-3 rounded-md border text-sm font-semibold",
                            entry.isCourierBox
                              ? "bg-muted/50 text-muted-foreground"
                              : isSemiMode && entry.weightKg > 0
                                ? "bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-900/20 dark:text-white-300"
                                : (isError || isBoxTypeError)
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
                      </div>

                      {/* ── Semi-packageable toggle row ── */}
                      {isSemiPackageable && (
                        <div className="px-4 pb-4 border-t border-border/50">
                          <div className="flex items-center gap-3 pt-3 flex-wrap">
                            <Switch
                              id={`semi-toggle-${entry.type}`}
                              checked={isSemiMode}
                              onCheckedChange={() => handleToggle(entry.type)}
                              disabled={locked}
                              className={locked ? "opacity-60 cursor-not-allowed" : ""}
                            />
                            <Label
                              htmlFor={`semi-toggle-${entry.type}`}
                              className={cn("text-sm select-none flex-1", locked ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer")}
                            >
                              {locked
                                ? "Must semi-package first"
                                : isSemiMode
                                  ? <span>Semi-packaging mode <span className="text-xs text-orange-600">(toggle OFF to convert to fully packaged)</span></span>
                                  : <span className="font-medium text-primary">Converting to fully packaged <span className="text-xs text-muted-foreground">(toggle ON to go back to semi mode)</span></span>}
                            </Label>

                            {isSemiMode && entry.packets > 0 && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button type="button" size="sm" variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground gap-1.5 shrink-0">
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Convert to Full Now
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Convert to Fully Packaged</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Convert <strong>{entry.packets} {entry.type}</strong> packets from semi-packaged to fully packaged?
                                      <br /><br />
                                      This will deduct <strong>{entry.packets}</strong> labels from inventory
                                      {entry.boxTypeId && entry.boxTypeName && (
                                        <> and <strong>{Math.ceil(entry.packets / entry.qtyPerBox)} {entry.boxTypeName}</strong> boxes</>
                                      )}{" "}
                                      immediately and count <strong>{(entry.packets * weightPerPacketKg).toFixed(3)} kg</strong> as fully packaged.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleConvertNow(entry.type)}>Convert Now</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>

                          {locked && (
                            <p className="text-xs text-muted-foreground mt-2 ml-10">
                              This label must be semi-packaged before it can be fully packaged.
                            </p>
                          )}
                          {isConversionMode && (
                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 ml-10">
                              Entering packets here converts from the <span className="font-semibold">{semiQty} semi-packaged</span> available.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Label stock error banner */}
              {labelStockErrors.length > 0 && (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive text-sm">Insufficient label stock</p>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {labelStockErrors.map((e) => (
                        <p key={e.type}>
                          • {e.type}: need {e.packets.toLocaleString("en-IN")} pcs,{" "}
                          {e.availableStock === 0 ? "none" : `only ${e.availableStock.toLocaleString("en-IN")}`} available
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Box type stock warning banner */}
              {boxTypeStockErrors.length > 0 && (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:bg-amber-900/20">
                  <Box className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 text-sm">Box stock will go negative</p>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {boxTypeStockErrors.map((e) => (
                        <p key={e.type}>
                          • {e.boxTypeName} (for {e.type}): need {e.boxes.toLocaleString("en-IN")} boxes,{" "}
                          {e.boxTypeStock === 0 ? "none" : `only ${e.boxTypeStock.toLocaleString("en-IN")}`} available
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Weight summary bar */}
              {(totalNewPackagedWeightKg > 0 || currentSessionSemiWeightKg > 0) && (
                <div className={cn(
                  "mt-4 rounded-lg p-4 flex items-center justify-between",
                  exceedsRemaining
                    ? "bg-destructive/10 border border-destructive/30"
                    : isExactMatch
                      ? "bg-success/10 border border-success/30"
                      : "bg-muted/50 border border-border"
                )}>
                  <div className="flex items-center gap-2">
                    {exceedsRemaining
                      ? <AlertTriangle className="h-5 w-5 text-destructive" />
                      : isExactMatch
                        ? <CheckCircle2 className="h-5 w-5 text-success" />
                        : <Info className="h-5 w-5 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium">
                        {exceedsRemaining ? "Exceeds remaining quantity" : isExactMatch ? "Exact match — ready to finish" : "Partial packaging"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {exceedsRemaining
                          ? `Reduce packets — max ${batch.remainingQuantity.toFixed(3)} kg remaining`
                          : isExactMatch
                            ? "Total weight matches remaining quantity"
                            : `${(batch.remainingQuantity - newWeightKg).toFixed(3)} kg still unpackaged`}
                      </p>
                      {currentSessionSemiWeightKg > 0 && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                          + {currentSessionSemiWeightKg.toFixed(3)} kg being semi-packaged this session
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {totalNewPackagedWeightKg > 0 ? "Fully packaged" : "Semi-packaged"}
                    </p>
                    <p className={cn(
                      "text-lg font-bold",
                      exceedsRemaining ? "text-destructive" : isExactMatch ? "text-success" : "text-foreground"
                    )}>
                      {totalNewPackagedWeightKg > 0
                        ? `${totalNewPackagedWeightKg.toFixed(3)} kg`
                        : `${currentSessionSemiWeightKg.toFixed(3)} kg`}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loss & Remarks */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Loss & Remarks</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Packaging Loss (kg)</Label>
              <Input type="number" step="0.001" min="0" value={packagingLoss} onChange={(e) => setPackagingLoss(e.target.value)} placeholder="0.000" />
            </div>
            <div className="space-y-1">
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Any notes about this packaging session..." rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Session Summary + Actions */}
        <Card className={cn(
          hasStockErrors && "border-destructive",
          !hasStockErrors && exceedsRemaining && "border-destructive",
          !hasStockErrors && !exceedsRemaining && isExactMatch && totalNewPackagedWeightKg > 0 && "border-success/50"
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {hasStockErrors
                ? <XCircle className="h-5 w-5 text-destructive" />
                : isExactMatch && totalNewPackagedWeightKg > 0
                  ? <CheckCircle2 className="h-5 w-5 text-success" />
                  : exceedsRemaining
                    ? <AlertTriangle className="h-5 w-5 text-destructive" />
                    : null}
              Session Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-muted/50 p-3 text-center rounded-lg">
                <p className="text-xs text-muted-foreground">Total Packets</p>
                <p className="font-semibold">{totalNewPackets.toLocaleString("en-IN")}</p>
              </div>
              <div className="bg-muted/50 p-3 text-center rounded-lg">
                <p className="text-xs text-muted-foreground">Fully Packaged</p>
                <p className="font-semibold">{totalNewPackagedWeightKg.toFixed(3)} kg</p>
              </div>
              <div className="bg-orange-100 dark:bg-orange-900/30 p-3 text-center rounded-lg">
                <p className="text-xs text-white-700 dark:text-white-300">Semi-Packaged</p>
                <p className="font-semibold text-white-700 dark:text-white-300">{currentSessionSemiWeightKg.toFixed(3)} kg</p>
              </div>
              <div className="bg-amber-100 dark:bg-amber-900/30 p-3 text-center rounded-lg">
                <p className="text-xs">Loss</p>
                <p className="font-semibold">{lossValue.toFixed(3)} kg</p>
              </div>
              <div className="bg-primary/10 p-3 text-center rounded-lg">
                <p className="text-xs text-primary">Remaining After</p>
                <p className="font-semibold text-primary">
                  {batch ? Math.max(0, batch.remainingQuantity - totalNewPackagedWeightKg).toFixed(3) : "0.000"} kg
                </p>
              </div>

              {/* Box types used this session */}
              {labelEntries
                .filter((e) => !e.isCourierBox && !semiToggles[e.type] && e.boxTypeId && e.boxes > 0)
                .map((e) => (
                  <div key={e.boxTypeId} className="bg-blue-50 dark:bg-blue-900/20 p-3 text-center rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center justify-center gap-1">
                      <Box className="h-3 w-3" /> {e.boxTypeName}
                    </p>
                    <p className="font-semibold text-blue-800 dark:text-blue-200">{e.boxes} boxes</p>
                    <p className="text-[10px] text-muted-foreground">for {e.type}</p>
                  </div>
                ))}
            </div>

            {/* Label summary badges */}
            {validLabels.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {validLabels.map((l) => {
                  const isSemi = semiToggles[l.type] === true;
                  return (
                    <Badge
                      key={l.type}
                      variant="secondary"
                      className={cn(
                        isSemi && "border-orange-400/50 bg-orange-50 text-orange-700 dark:bg-orange-900/20",
                        l.stockStatus === "out" && !isSemi && "border-destructive/50 bg-destructive/10 text-destructive",
                        l.stockStatus === "low" && !isSemi && "border-amber-400/50 bg-amber-50 text-amber-700 dark:bg-amber-900/20",
                      )}
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {l.isCourierBox
                        ? `${l.type}: ${l.packets.toLocaleString("en-IN")} boxes`
                        : isSemi
                          ? `${l.type}: ${l.packets.toLocaleString("en-IN")} pcs (semi)`
                          : `${l.type}: ${l.packets.toLocaleString("en-IN")} pcs (${l.boxes} boxes)`}
                      {l.stockStatus === "out" && !isSemi && <XCircle className="h-3 w-3 ml-1" />}
                      {l.stockStatus === "low" && !isSemi && <AlertTriangle className="h-3 w-3 ml-1" />}
                    </Badge>
                  );
                })}
                {/* Box type badges */}
                {labelEntries
                  .filter((e) => !e.isCourierBox && !semiToggles[e.type] && e.boxTypeId && e.boxes > 0)
                  .map((e) => (
                    <Badge
                      key={`box-${e.boxTypeId}`}
                      variant="secondary"
                      className={cn(
                        "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/20",
                        e.boxTypeStockStatus === "out" && "border-destructive/50 bg-destructive/10 text-destructive",
                        e.boxTypeStockStatus === "low" && "border-amber-400/50 bg-amber-50 text-amber-700",
                      )}
                    >
                      <Box className="h-3 w-3 mr-1" />
                      {e.boxTypeName}: {e.boxes} boxes
                      {e.boxTypeStockStatus === "out" && <XCircle className="h-3 w-3 ml-1" />}
                      {e.boxTypeStockStatus === "low" && <AlertTriangle className="h-3 w-3 ml-1" />}
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
                    Please restock the labels above before saving or finishing.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {!isExactMatch && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={
                        (totalNewPackagedWeightKg <= 0 && currentSessionSemiWeightKg <= 0) ||
                        exceedsRemaining || isSubmitting || isFinishing || hasStockErrors
                      }
                      className="flex-1"
                    >
                      {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Packaging (Partial)"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Save Partial Packaging</AlertDialogTitle>
                      <AlertDialogDescription>
                        {totalNewPackagedWeightKg > 0 && `${totalNewPackagedWeightKg.toFixed(3)} kg will be recorded as fully packaged. `}
                        {currentSessionSemiWeightKg > 0 && `${currentSessionSemiWeightKg.toFixed(3)} kg will be recorded as semi-packaged (label stock deferred). `}
                        {(batch.remainingQuantity - totalNewPackagedWeightKg).toFixed(3)} kg will remain for future sessions.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSubmit}>Save</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={
                      exceedsRemaining || isSubmitting || isFinishing ||
                      (batch.remainingQuantity <= 0 && (batch.semiPackaged ?? 0) <= 0) ||
                      hasStockErrors
                    }
                    className={cn(
                      "flex-1",
                      isExactMatch && totalNewPackagedWeightKg > 0 && !hasStockErrors && "bg-success hover:bg-success/90"
                    )}
                  >
                    {isFinishing
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Finishing...</>
                      : isExactMatch && totalNewPackagedWeightKg > 0
                        ? <><CheckCircle2 className="h-4 w-4 mr-2" /> Mark as Finished</>
                        : "Mark as Finished (with remaining as loss)"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark Batch as Finished</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isExactMatch && totalNewPackagedWeightKg > 0
                        ? <>All {batch.remainingQuantity.toFixed(3)} kg will be recorded as packaged.</>
                        : <>
                          {totalNewPackagedWeightKg > 0 ? `${totalNewPackagedWeightKg.toFixed(3)} kg will be packaged and ` : ""}
                          {Math.max(0, batch.remainingQuantity - totalNewPackagedWeightKg).toFixed(3)} kg will be counted as loss.
                        </>}
                      {validLabels.filter((l) => semiToggles[l.type] !== true).length > 0 && (
                        <>
                          <br /><br />
                          <strong>Label stock will be deducted:</strong><br />
                          {validLabels.filter((l) => semiToggles[l.type] !== true).map((l) => (
                            <span key={l.type} className="block">
                              {l.isCourierBox
                                ? `• ${l.type}: ${l.packets.toLocaleString("en-IN")} boxes`
                                : `• ${l.type}: ${l.packets.toLocaleString("en-IN")} pcs (${l.boxes} boxes)`}
                            </span>
                          ))}
                          {labelEntries.filter((e) => !e.isCourierBox && !semiToggles[e.type] && e.boxTypeId && e.boxes > 0).length > 0 && (
                            <>
                              <br /><strong>Box stock will be deducted:</strong><br />
                              {labelEntries.filter((e) => !e.isCourierBox && !semiToggles[e.type] && e.boxTypeId && e.boxes > 0).map((e) => (
                                <span key={e.boxTypeId} className="block">• {e.boxTypeName}: {e.boxes} boxes</span>
                              ))}
                            </>
                          )}
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
