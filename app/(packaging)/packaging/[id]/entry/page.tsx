"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Package,
  ArrowLeft,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Tag,
  Box,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  PackagedItem,
  calculateItemWeight,
  calculatePackagedWeight,
  validatePackagingEntry,
  getStatusColor,
} from "@/data/packagingData";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  formulationId: string;
  quantity: number;
  unit: "kg" | "gm";
  availableInventory: number;
  createdAt: string;
  // labels[].quantity = qty per courier box (e.g. 10 jars per box)
  labels: Array<{ type: string; quantity: number }>;
}

interface LabelEntry {
  id: string;
  type: string;
  qtyPerBox: number;   // from product definition (read-only reference)
  quantity: number;    // auto-calculated boxes needed, editable by user
}

interface CourierBox {
  label: string;
  itemsPerBox: number;
  boxesNeeded: number;
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

const PACKETS_PER_BOX = 10;

// ─── Component ────────────────────────────────────────────────────────────────

const PackagingEntry = () => {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const batchNumber = params.id;

  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [batch, setBatch] = useState<PackagingBatch | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<PackagedItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [packetCount, setPacketCount] = useState("");

  // Labels: auto-filled, user-editable
  const [labels, setLabels] = useState<LabelEntry[]>([]);

  const [courierEnabled, setCourierEnabled] = useState(false);
  const [courierBox, setCourierBox] = useState<CourierBox>({
    label: "",
    itemsPerBox: PACKETS_PER_BOX,
    boxesNeeded: 0,
  });

  const [packagingLoss, setPackagingLoss] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // ─── Fetch ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      if (!batchNumber) return;
      try {
        setIsLoading(true);
        setError(null);

        const batchRes = await fetch(
          `/api/packaging/batches/${encodeURIComponent(batchNumber as string)}`
        );
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
        const productsData: Product[] = await productsRes.json();

        setBatch(batchData);
        setProducts(productsData);
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

  // ─── Derived values ───────────────────────────────────────────────────────

  const totalPackagedWeight = calculatePackagedWeight(items);
  const lossValue = parseFloat(packagingLoss) || 0;
  const totalUsed = totalPackagedWeight + lossValue;
  const isValid = batch
    ? validatePackagingEntry(batch.remainingQuantity, items, lossValue)
    : { valid: false, message: "" };
  const totalPackets = items.reduce((sum, item) => sum + item.numberOfPackets, 0);

  // Auto-recalculate courier boxes when packets or itemsPerBox changes
  useEffect(() => {
    if (courierBox.itemsPerBox > 0 && totalPackets > 0) {
      setCourierBox((prev) => ({
        ...prev,
        boxesNeeded: Math.ceil(totalPackets / prev.itemsPerBox),
      }));
    } else {
      setCourierBox((prev) => ({ ...prev, boxesNeeded: 0 }));
    }
  }, [totalPackets, courierBox.itemsPerBox]);

  // Auto-set itemsPerBox = 10 when courier is enabled
  useEffect(() => {
    if (courierEnabled) {
      setCourierBox((prev) => ({
        ...prev,
        itemsPerBox: PACKETS_PER_BOX,
        boxesNeeded: totalPackets > 0 ? Math.ceil(totalPackets / PACKETS_PER_BOX) : 0,
      }));
    }
  }, [courierEnabled]);

  // ─── Recalculate labels when packet count changes ─────────────────────────
  // This recalculates ALL label entries based on their qtyPerBox and current items

  const recalculateLabels = (updatedItems: PackagedItem[]) => {
    // Build a map of labelType -> total boxes needed across all items
    const labelTotals = new Map<string, { qtyPerBox: number; boxes: number }>();

    for (const item of updatedItems) {
      const product = products.find((p) => p.id === item.containerId);
      if (!product?.labels?.length) continue;

      for (const productLabel of product.labels) {
        const boxesForThisItem = Math.ceil(
          item.numberOfPackets / productLabel.quantity
        );
        const existing = labelTotals.get(productLabel.type.toLowerCase());
        if (existing) {
          existing.boxes += boxesForThisItem;
        } else {
          labelTotals.set(productLabel.type.toLowerCase(), {
            qtyPerBox: productLabel.quantity,
            boxes: boxesForThisItem,
          });
        }
      }
    }

    // Rebuild label entries — preserve manual entries (those with no qtyPerBox)
    setLabels((prevLabels) => {
      const manualLabels = prevLabels.filter((l) => l.qtyPerBox === 0);

      const autoLabels: LabelEntry[] = Array.from(labelTotals.entries()).map(
        ([type, { qtyPerBox, boxes }]) => ({
          id: `auto-${type}`,
          type,
          qtyPerBox,
          quantity: boxes,
        })
      );

      return [...autoLabels, ...manualLabels];
    });
  };

  // ─── Product handlers ─────────────────────────────────────────────────────

  const handleAddItem = () => {
    if (!selectedProduct || !packetCount || parseInt(packetCount) <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please select a product and enter packet count",
        variant: "destructive",
      });
      return;
    }

    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    const count = parseInt(packetCount);
    const quantityInGrams =
      product.unit === "kg" ? product.quantity * 1000 : product.quantity;

    const existingIndex = items.findIndex((item) => item.containerId === selectedProduct);
    let updatedItems: PackagedItem[];

    if (existingIndex >= 0) {
      updatedItems = [...items];
      const newCount = updatedItems[existingIndex].numberOfPackets + count;
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        numberOfPackets: newCount,
        totalWeight: calculateItemWeight(quantityInGrams, newCount),
      };
    } else {
      updatedItems = [
        ...items,
        {
          containerId: product.id,
          containerSize: quantityInGrams,
          containerLabel: `${product.name} (${product.quantity}${product.unit})`,
          numberOfPackets: count,
          totalWeight: calculateItemWeight(quantityInGrams, count),
        },
      ];
    }

    setItems(updatedItems);
    recalculateLabels(updatedItems);
    setSelectedProduct("");
    setPacketCount("");
  };

  const handleRemoveItem = (containerId: string) => {
    const updatedItems = items.filter((i) => i.containerId !== containerId);
    setItems(updatedItems);
    recalculateLabels(updatedItems);
  };

  // ─── Label handlers ───────────────────────────────────────────────────────

  const addManualLabel = () => {
    setLabels((prev) => [
      ...prev,
      { id: `manual-${Date.now()}`, type: "", qtyPerBox: 0, quantity: 0 },
    ]);
  };

  const removeLabel = (id: string) => {
    setLabels((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLabel = (id: string, field: "type" | "quantity", value: string | number) => {
    setLabels((prev) =>
      prev.map((l) =>
        l.id === id
          ? { ...l, [field]: field === "quantity" ? Number(value) : value }
          : l
      )
    );
  };

  // ─── Courier box handlers ─────────────────────────────────────────────────

  const handleCourierChange = (field: keyof CourierBox, value: string | number) => {
    setCourierBox((prev) => {
      const updated = { ...prev, [field]: field === "label" ? value : Number(value) };
      if (field === "itemsPerBox" && Number(value) > 0 && totalPackets > 0) {
        updated.boxesNeeded = Math.ceil(totalPackets / Number(value));
      }
      return updated;
    });
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!isValid.valid) {
      toast({ title: "Validation Error", description: isValid.message, variant: "destructive" });
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
          items: items.map((item) => ({
            containerId: item.containerId,
            numberOfPackets: item.numberOfPackets,
            totalWeight: item.totalWeight,
          })),
          packagingLoss: lossValue,
          remarks: remarks || undefined,
          labels: labels
            .filter((l) => l.type.trim() && l.quantity > 0)
            .map((l) => ({ type: l.type.trim(), quantity: l.quantity })),
          courierBox:
            courierEnabled && courierBox.itemsPerBox > 0
              ? {
                  label: courierBox.label || "Courier Box",
                  itemsPerBox: courierBox.itemsPerBox,
                  boxesNeeded: courierBox.boxesNeeded,
                }
              : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to save packaging session");
      }

      toast({
        title: "Packaging Recorded",
        description: `Successfully packaged ${totalPackagedWeight.toFixed(3)} kg`,
      });
      router.push(`/packaging/${encodeURIComponent(batch!.batchNumber)}/summary`);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save packaging session.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishBatch = async () => {
    if (batch!.remainingQuantity <= 0) {
      toast({
        title: "Batch Already Finished",
        description: "This batch has no remaining quantity.",
        variant: "destructive",
      });
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
            items: items.length > 0
              ? items.map((item) => ({
                  containerId: item.containerId,
                  numberOfPackets: item.numberOfPackets,
                  totalWeight: item.totalWeight,
                }))
              : [],
            // Pass labels so backend deducts from label inventory
            labels: labels
              .filter((l) => l.type.trim() && l.quantity > 0)
              .map((l) => ({ type: l.type.trim(), quantity: l.quantity })),
            remarks:
              remarks ||
              `Batch marked as finished. Remaining ${batch!.remainingQuantity.toFixed(3)} kg counted as loss.`,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to mark batch as finished");
      }

      toast({
        title: "Batch Finished",
        description: `Batch marked as finished. ${batch!.remainingQuantity.toFixed(3)} kg counted as loss.`,
      });
      router.push(`/packaging/${encodeURIComponent(batch!.batchNumber)}/summary`);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to mark batch as finished.",
        variant: "destructive",
      });
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
          <p className="text-muted-foreground mb-4">
            {error || "The requested batch could not be found."}
          </p>
          <Button onClick={() => router.push("/packaging")}>Back to Packaging</Button>
        </div>
      </AppLayout>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const validLabels = labels.filter((l) => l.type.trim() && l.quantity > 0);

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
            <p className="text-sm text-muted-foreground">
              Record packaging for {batch.productName}
            </p>
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

        {/* Add Product */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add Product</CardTitle>
            <p className="text-sm text-muted-foreground">
              Selecting a product auto-fills label quantities below based on packet count ÷ qty per box
            </p>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label>Product</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} (Current: {product.availableInventory || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Number of Packets</Label>
              <Input
                type="number"
                min={1}
                value={packetCount}
                onChange={(e) => setPacketCount(e.target.value)}
                placeholder="e.g. 100"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Added Products Table */}
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Added Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Container Size</TableHead>
                      <TableHead>Packets</TableHead>
                      <TableHead className="text-right">Total Weight (kg)</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const product = products.find((p) => p.id === item.containerId);
                      return (
                        <TableRow key={item.containerId}>
                          <TableCell className="font-medium">
                            {product?.name || "Unknown Product"}
                          </TableCell>
                          <TableCell>{item.containerLabel}</TableCell>
                          <TableCell>{item.numberOfPackets}</TableCell>
                          <TableCell className="text-right">
                            {item.totalWeight.toFixed(3)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(item.containerId)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Labels Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tag className="h-5 w-5 text-primary" />
                Labels
                <span className="text-sm font-normal text-muted-foreground">
                  (auto-calculated from packets ÷ qty per box)
                </span>
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addManualLabel}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Label
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Courier boxes needed are auto-filled. You can edit before finishing.
              Stock will be deducted when the batch is marked as finished.
            </p>
          </CardHeader>
          <CardContent>
            {labels.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Tag className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  Add a product above — label quantities will auto-fill here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {labels.map((label, index) => (
                  <div
                    key={label.id}
                    className="flex items-end gap-3 p-4 border rounded-lg bg-muted/30"
                  >
                    {/* Label type */}
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`label-type-${label.id}`}>
                        Label Type {index + 1}
                      </Label>
                      <Input
                        id={`label-type-${label.id}`}
                        value={label.type}
                        onChange={(e) => updateLabel(label.id, "type", e.target.value)}
                        placeholder="Label name"
                        // auto-filled labels have a type locked from product
                        readOnly={label.qtyPerBox > 0}
                        className={label.qtyPerBox > 0 ? "bg-muted/60" : ""}
                      />
                    </div>

                    {/* Qty per box — read only info */}
                    {label.qtyPerBox > 0 && (
                      <div className="w-28 space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Per Box
                        </Label>
                        <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 text-sm text-muted-foreground">
                          {label.qtyPerBox} pcs
                        </div>
                      </div>
                    )}

                    {/* Boxes needed — editable */}
                    <div className="w-36 space-y-1">
                      <Label htmlFor={`label-qty-${label.id}`}>
                        {label.qtyPerBox > 0 ? "Boxes Needed" : "Quantity"}
                      </Label>
                      <div className="relative">
                        <Input
                          id={`label-qty-${label.id}`}
                          type="number"
                          min="1"
                          value={label.quantity || ""}
                          onChange={(e) => updateLabel(label.id, "quantity", e.target.value)}
                          placeholder="0"
                          className="pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {label.qtyPerBox > 0 ? "boxes" : "pcs"}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLabel(label.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
        <Card className={!isValid.valid && items.length ? "border-destructive" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {isValid.valid && items.length ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : items.length ? (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              ) : null}
              Session Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-muted/50 p-3 text-center rounded-lg">
                <p className="text-xs text-muted-foreground">Items</p>
                <p className="font-semibold">{items.length}</p>
              </div>
              <div className="bg-muted/50 p-3 text-center rounded-lg">
                <p className="text-xs text-muted-foreground">Packaged</p>
                <p className="font-semibold">{totalPackagedWeight.toFixed(3)} kg</p>
              </div>
              <div className="bg-amber-100 dark:bg-amber-900/30 p-3 text-center rounded-lg">
                <p className="text-xs">Loss</p>
                <p className="font-semibold">{lossValue.toFixed(3)} kg</p>
              </div>
              <div className="bg-primary/10 p-3 text-center rounded-lg">
                <p className="text-xs text-primary">Total Used</p>
                <p className="font-semibold text-primary">{totalUsed.toFixed(3)} kg</p>
              </div>
            </div>

            {courierEnabled && courierBox.boxesNeeded > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                <Box className="h-4 w-4 text-primary shrink-0" />
                <span>
                  <span className="font-medium">{courierBox.boxesNeeded} courier boxes</span>
                  {courierBox.label && (
                    <span className="text-muted-foreground"> ({courierBox.label})</span>
                  )}
                  <span className="text-muted-foreground">
                    {" "}— {courierBox.itemsPerBox} packets each
                  </span>
                </span>
              </div>
            )}

            {validLabels.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {validLabels.map((l) => (
                  <Badge key={l.id} variant="secondary">
                    <Tag className="h-3 w-3 mr-1" />
                    {l.type}: {l.quantity} {l.qtyPerBox > 0 ? "boxes" : "pcs"}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Save Packaging */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={!isValid.valid || !items.length || isSubmitting}
                    className="flex-1"
                  >
                    Save Packaging
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Packaging</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will record {totalPackagedWeight.toFixed(3)} kg with{" "}
                      {lossValue.toFixed(3)} kg loss.
                      {validLabels.length > 0 && (
                        <> Label stock will be deducted when the batch is marked as finished.</>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit}>Confirm</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Mark as Finished */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isSubmitting || isFinishing || batch.remainingQuantity <= 0}
                    className="flex-1"
                  >
                    Mark as Finished
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark Batch as Finished</AlertDialogTitle>
                    <AlertDialogDescription>
                      Remaining {batch.remainingQuantity.toFixed(3)} kg will be counted as loss.
                      {validLabels.length > 0 && (
                        <>
                          <br /><br />
                          <strong>Label stock will be deducted from inventory:</strong>
                          <br />
                          {validLabels.map((l) => (
                            <span key={l.id} className="block">
                              • {l.type}: {l.quantity} {l.qtyPerBox > 0 ? "boxes" : "pcs"}
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
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Mark as Finished
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
};

export default PackagingEntry;