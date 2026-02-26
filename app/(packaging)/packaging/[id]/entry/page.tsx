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

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  formulationId: string;
  quantity: number;
  unit: "kg" | "gm";
  availableInventory: number;
  createdAt: string;
}

interface ProductLabel {
  type: string;   // label name, e.g. "box", "packet"
  quantity: number; // weight/size per unit
}

interface LabelEntry {
  id: string;
  type: string;   // custom label type text
  quantity: number; // number of labels used
}

interface CourierBox {
  label: string;        // custom description e.g. "Medium Box"
  itemsPerBox: number;  // how many packets fit in one box
  boxesNeeded: number;  // auto-calculated
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

// ─── Component ───────────────────────────────────────────────────────────────

const PackagingEntry = () => {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const batchNumber = params.id;

  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Data
  const [batch, setBatch] = useState<PackagingBatch | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Product packaging
  const [items, setItems] = useState<PackagedItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [packetCount, setPacketCount] = useState("");

  // Labels
  const [labels, setLabels] = useState<LabelEntry[]>([]);

  // Courier box
  const [courierEnabled, setCourierEnabled] = useState(false);
  const [courierBox, setCourierBox] = useState<CourierBox>({
    label: "",
    itemsPerBox: 0,
    boxesNeeded: 0,
  });

  // Session meta
  const [packagingLoss, setPackagingLoss] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchData = async () => {
      if (!batchNumber) return;
      try {
        setIsLoading(true);
        setError(null);

        const batchRes = await fetch(
          `/api/packaging/batches/${encodeURIComponent(batchNumber as string)}`
        );
        if (!batchRes.ok) throw new Error(batchRes.status === 404 ? "Batch not found" : "Failed to fetch batch details");

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

  // ─── Derived values ──────────────────────────────────────────────────────────

  const totalPackagedWeight = calculatePackagedWeight(items);
  const lossValue = parseFloat(packagingLoss) || 0;
  const totalUsed = totalPackagedWeight + lossValue;
  const isValid = batch ? validatePackagingEntry(batch.remainingQuantity, items, lossValue) : { valid: false, message: "" };

  // Total packets across all items (for courier box calculation)
  const totalPackets = items.reduce((sum, item) => sum + item.numberOfPackets, 0);

  // Auto-recalculate courier boxes when items or itemsPerBox changes
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

  // ─── Product handlers ────────────────────────────────────────────────────────

  const handleAddItem = () => {
    if (!selectedProduct || !packetCount || parseInt(packetCount) <= 0) {
      toast({ title: "Invalid Input", description: "Please select a product and enter packet count", variant: "destructive" });
      return;
    }

    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    const count = parseInt(packetCount);
    const quantityInGrams = product.unit === "kg" ? product.quantity * 1000 : product.quantity;

    const existingIndex = items.findIndex((item) => item.containerId === selectedProduct);

    if (existingIndex >= 0) {
      const updated = [...items];
      const newCount = updated[existingIndex].numberOfPackets + count;
      updated[existingIndex] = {
        ...updated[existingIndex],
        numberOfPackets: newCount,
        totalWeight: calculateItemWeight(quantityInGrams, newCount),
      };
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          containerId: product.id,
          containerSize: quantityInGrams,
          containerLabel: `${product.name} (${product.quantity}${product.unit})`,
          numberOfPackets: count,
          totalWeight: calculateItemWeight(quantityInGrams, count),
        },
      ]);
    }

    setSelectedProduct("");
    setPacketCount("");
  };

  const handleRemoveItem = (containerId: string) => {
    setItems(items.filter((i) => i.containerId !== containerId));
  };

  // ─── Label handlers ──────────────────────────────────────────────────────────

  const addLabel = () => {
    setLabels((prev) => [
      ...prev,
      { id: `label-${Date.now()}`, type: "", quantity: 0 },
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

  // ─── Courier box handlers ────────────────────────────────────────────────────

  const handleCourierChange = (field: keyof CourierBox, value: string | number) => {
    setCourierBox((prev) => {
      const updated = { ...prev, [field]: field === "label" ? value : Number(value) };
      if (field === "itemsPerBox" && Number(value) > 0 && totalPackets > 0) {
        updated.boxesNeeded = Math.ceil(totalPackets / Number(value));
      }
      return updated;
    });
  };

  // ─── Submit handlers ─────────────────────────────────────────────────────────

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
          labels: labels.filter((l) => l.type.trim() && l.quantity > 0).map((l) => ({
            type: l.type.trim(),
            quantity: l.quantity,
          })),
          courierBox: courierEnabled && courierBox.itemsPerBox > 0
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
        description: `Successfully packaged ${totalPackagedWeight.toFixed(3)} kg with ${lossValue.toFixed(3)} kg loss`,
      });

      router.push(`/packaging/${encodeURIComponent(batch!.batchNumber)}/summary`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save packaging session. Please try again.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishBatch = async () => {
    if (batch!.remainingQuantity <= 0) {
      toast({ title: "Batch Already Finished", description: "This batch has no remaining quantity.", variant: "destructive" });
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
            remarks: remarks || `Batch marked as finished. Remaining ${batch!.remainingQuantity.toFixed(3)} kg counted as loss.`,
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
      const message = err instanceof Error ? err.message : "Failed to mark batch as finished. Please try again.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsFinishing(false);
    }
  };

  // ─── Loading / Error states ──────────────────────────────────────────────────

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
          <Button className="h-11 min-w-[200px] justify-center" onClick={() => router.push("/packaging")}>
            Back to Packaging
          </Button>
        </div>
      </AppLayout>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

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

        {/* Add Product */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add Product</CardTitle>
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
                          <TableCell className="font-medium">{product?.name || "Unknown Product"}</TableCell>
                          <TableCell>{item.containerLabel}</TableCell>
                          <TableCell>{item.numberOfPackets}</TableCell>
                          <TableCell className="text-right">{item.totalWeight.toFixed(3)}</TableCell>
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

        {/* ── Labels Section ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tag className="h-5 w-5 text-primary" />
                Labels
                <span className="text-sm font-normal text-muted-foreground">(Optional)</span>
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLabel} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Label
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Track label types and quantities used in this session
            </p>
          </CardHeader>
          <CardContent>
            {labels.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Tag className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No labels added. Click "Add Label" to track packaging labels.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {labels.map((label, index) => (
                  <div key={label.id} className="flex items-end gap-3 p-4 border rounded-lg bg-muted/30">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`label-type-${label.id}`}>Label Type {index + 1}</Label>
                      <Input
                        id={`label-type-${label.id}`}
                        value={label.type}
                        onChange={(e) => updateLabel(label.id, "type", e.target.value)}
                        placeholder="e.g., Box, Packet, Pouch, Sticker"
                      />
                    </div>
                    <div className="w-32 space-y-1">
                      <Label htmlFor={`label-qty-${label.id}`}>Quantity</Label>
                      <Input
                        id={`label-qty-${label.id}`}
                        type="number"
                        min="1"
                        value={label.quantity || ""}
                        onChange={(e) => updateLabel(label.id, "quantity", e.target.value)}
                        placeholder="0"
                      />
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

        {/* ── Courier Box Section ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Box className="h-5 w-5 text-primary" />
                Courier Box
                <span className="text-sm font-normal text-muted-foreground">(Optional)</span>
              </CardTitle>
              <Button
                type="button"
                variant={courierEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setCourierEnabled((v) => !v)}
              >
                {courierEnabled ? "Disable" : "Enable"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Calculate how many courier boxes are needed based on packets per box
            </p>
          </CardHeader>

          {courierEnabled && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Box label */}
                <div className="space-y-1">
                  <Label>Box Description</Label>
                  <Input
                    value={courierBox.label}
                    onChange={(e) => handleCourierChange("label", e.target.value)}
                    placeholder="e.g., Medium Corrugated Box"
                  />
                </div>

                {/* Items per box */}
                <div className="space-y-1">
                  <Label>Packets per Box</Label>
                  <Input
                    type="number"
                    min="1"
                    value={courierBox.itemsPerBox || ""}
                    onChange={(e) => handleCourierChange("itemsPerBox", e.target.value)}
                    placeholder="e.g., 10"
                  />
                </div>

                {/* Auto-calculated boxes */}
                <div className="space-y-1">
                  <Label>Boxes Needed (auto)</Label>
                  <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 font-semibold text-primary">
                    {courierBox.boxesNeeded > 0 ? courierBox.boxesNeeded : "—"}
                  </div>
                </div>
              </div>

              {/* Info row */}
              {courierBox.itemsPerBox > 0 && totalPackets > 0 && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{totalPackets} total packets</span>
                  {" ÷ "}
                  <span className="font-medium text-foreground">{courierBox.itemsPerBox} per box</span>
                  {" = "}
                  <span className="font-semibold text-primary">{courierBox.boxesNeeded} boxes needed</span>
                  {totalPackets % courierBox.itemsPerBox !== 0 && (
                    <span className="text-amber-600 ml-2">
                      (last box has {totalPackets % courierBox.itemsPerBox} packet{totalPackets % courierBox.itemsPerBox > 1 ? "s" : ""})
                    </span>
                  )}
                </div>
              )}

              {courierBox.itemsPerBox > 0 && totalPackets === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  Add products above to calculate boxes needed.
                </p>
              )}
            </CardContent>
          )}
        </Card>

        {/* Packaging Loss + Remarks */}
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

        {/* Session Summary + Save */}
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
                  {courierBox.label && <span className="text-muted-foreground"> ({courierBox.label})</span>}
                  <span className="text-muted-foreground"> — {courierBox.itemsPerBox} packets each</span>
                </span>
              </div>
            )}

            {labels.filter((l) => l.type.trim() && l.quantity > 0).length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {labels.filter((l) => l.type.trim() && l.quantity > 0).map((l) => (
                  <Badge key={l.id} variant="secondary">
                    {l.type}: {l.quantity}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={!isValid.valid || !items.length || isSubmitting} className="flex-1">
                    Save Packaging
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Packaging</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will record {totalPackagedWeight.toFixed(3)} kg with {lossValue.toFixed(3)} kg loss.
                      {courierEnabled && courierBox.boxesNeeded > 0 && (
                        <> {courierBox.boxesNeeded} courier boxes will also be recorded.</>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit}>Confirm</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

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
                      This will mark the batch as finished. Any remaining quantity ({batch.remainingQuantity.toFixed(3)} kg) will be counted as loss.
                      {items.length > 0 && (
                        <><br /><br />Any items you've added will also be saved in this session.</>
                      )}
                      <br /><br />Are you sure you want to continue?
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