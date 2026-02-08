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

interface Product {
  id: string;
  name: string;
  formulationId: string;
  quantity: number;
  unit: 'kg' | 'gm';
  availableInventory: number;
  createdAt: string;
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
  const [packagingLoss, setPackagingLoss] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [packetCount, setPacketCount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!batchNumber) return;

      try {
        setIsLoading(true);
        setError(null);

        const batchRes = await fetch(
          `/api/packaging/batches/${encodeURIComponent(batchNumber as string)}`
        );

        if (!batchRes.ok) {
          if (batchRes.status === 404) {
            throw new Error("Batch not found");
          }
          throw new Error("Failed to fetch batch details");
        }

        const batchData: PackagingBatch = await batchRes.json();
        console.log('Batch data:', batchData); // Debug log

        if (batchData.status === "Completed") {
          router.push("/packaging");
          return;
        }

        // Fetch products for the formulation
        const productsRes = await fetch(`/api/formulations/${batchData.formulationId}/products/packaging`);
        if (!productsRes.ok) {
          throw new Error("Failed to fetch formulation products");
        }

        const productsData: Product[] = await productsRes.json();
        console.log('Fetched products:', productsData); // Debug log

        setBatch(batchData);
        setProducts(productsData);
      } catch (err) {
        console.error("Error loading packaging entry data:", err);
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load packaging entry data";
        setError(message);
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [batchNumber, router, toast]);

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
          <Button
            className="h-11 min-w-[200px] justify-center"
            onClick={() => router.push("/packaging")}
          >
            Back to Packaging
          </Button>
        </div>
      </AppLayout>
    );
  }

  const totalPackagedWeight = calculatePackagedWeight(items);
  const lossValue = parseFloat(packagingLoss) || 0;
  const totalUsed = totalPackagedWeight + lossValue;

  const isValid = validatePackagingEntry(
    batch.remainingQuantity,
    items,
    lossValue
  );

  const handleAddItem = () => {
    if (!selectedProduct || !packetCount || parseInt(packetCount) <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please select a product and enter packet count",
        variant: "destructive",
      });
      return;
    }

    const product = products.find(
      (p) => p.id === selectedProduct
    );
    if (!product) return;

    const count = parseInt(packetCount);

    // Convert product quantity to grams for calculation
    const quantityInGrams = product.unit === 'kg' ? product.quantity * 1000 : product.quantity;

    // No inventory check needed for packaging - we're creating inventory
    const existingIndex = items.findIndex(
      (item) => item.containerId === selectedProduct
    );

    if (existingIndex >= 0) {
      const updated = [...items];
      const newCount = updated[existingIndex].numberOfPackets + count;

      updated[existingIndex] = {
        ...updated[existingIndex],
        numberOfPackets: newCount,
        totalWeight: calculateItemWeight(quantityInGrams, newCount), // Pass grams directly
      };

      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          containerId: product.id,
          containerSize: quantityInGrams, // Keep in grams for calculateItemWeight
          containerLabel: `${product.name} (${product.quantity}${product.unit})`,
          numberOfPackets: count,
          totalWeight: calculateItemWeight(quantityInGrams, count),
        },
      ]);
    }

    // Reset form
    setSelectedProduct("");
    setPacketCount("");
  };

  const handleRemoveItem = (containerId: string) => {
    setItems(items.filter((i) => i.containerId !== containerId));
  };

  const handleUpdatePacketCount = (containerId: string, count: string) => {
    const product = products.find((p) => p.id === containerId);
    if (!product) return;

    const newCount = parseInt(count) || 0;

    // Convert product quantity to grams for calculation
    const quantityInGrams = product.unit === 'kg' ? product.quantity * 1000 : product.quantity;

    // No inventory check needed for packaging - we're creating inventory
    setItems(
      items.map((item) =>
        item.containerId === containerId
          ? {
              ...item,
              numberOfPackets: newCount,
              totalWeight: calculateItemWeight(
                quantityInGrams, // Pass grams directly
                newCount
              ),
            }
          : item
      )
    );
  };

  const handleSubmit = async () => {
    if (!isValid.valid) {
      toast({
        title: "Validation Error",
        description: isValid.message,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/packaging/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batchNumber: batch.batchNumber,
          date: new Date().toISOString(),
          items: items.map((item) => ({
            containerId: item.containerId,
            numberOfPackets: item.numberOfPackets,
            totalWeight: item.totalWeight,
          })),
          packagingLoss: lossValue,
          remarks: remarks || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to save packaging session");
      }

      toast({
        title: "Packaging Recorded",
        description: `Successfully packaged ${totalPackagedWeight.toFixed(
          3
        )} kg with ${lossValue.toFixed(3)} kg loss`,
      });

      router.push(`/packaging/${encodeURIComponent(batch.batchNumber)}/summary`);
    } catch (err) {
      console.error("Error saving packaging session:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to save packaging session. Please try again.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishBatch = async () => {
    if (batch.remainingQuantity <= 0) {
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
        `/api/packaging/batches/${encodeURIComponent(batch.batchNumber)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items:
              items.length > 0
                ? items.map((item) => ({
                    containerId: item.containerId,
                    numberOfPackets: item.numberOfPackets,
                    totalWeight: item.totalWeight,
                  }))
                : [],
            remarks:
              remarks ||
              `Batch marked as finished. Remaining ${batch.remainingQuantity.toFixed(
                3
              )} kg counted as loss.`,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || "Failed to mark batch as finished"
        );
      }

      toast({
        title: "Batch Finished",
        description: `Batch marked as finished. ${batch.remainingQuantity.toFixed(
          3
        )} kg counted as loss.`,
      });

      router.push(`/packaging/${encodeURIComponent(batch.batchNumber)}/summary`);
    } catch (err) {
      console.error("Error finishing batch:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to mark batch as finished. Please try again.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/packaging")}
          >
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
            <Badge className={getStatusColor(batch.status)}>
              {batch.status}
            </Badge>
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
              <p className="font-semibold text-sm">
                {batch.producedQuantity} kg
              </p>
            </div>
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <p className="text-xs text-primary">Remaining</p>
              <p className="font-semibold text-primary">
                {batch.remainingQuantity} kg
              </p>
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
              <Select
                value={selectedProduct}
                onValueChange={setSelectedProduct}
              >
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
                      <TableHead>Number of Packets</TableHead>
                      <TableHead className="text-right">Total Weight (kg)</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const product = products.find(p => p.id === item.containerId);
                      return (
                        <TableRow key={item.containerId}>
                          <TableCell className="font-medium">
                            {product?.name || 'Unknown Product'}
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

        {/* Summary + Save */}
        <Card
          className={!isValid.valid && items.length ? "border-destructive" : ""}
        >
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
                <p className="font-semibold">
                  {totalPackagedWeight.toFixed(3)} kg
                </p>
              </div>
              <div className="bg-amber-100 dark:bg-amber-900/30 p-3 text-center rounded-lg">
                <p className="text-xs">Loss</p>
                <p className="font-semibold">
                  {lossValue.toFixed(3)} kg
                </p>
              </div>
              <div className="bg-primary/10 p-3 text-center rounded-lg">
                <p className="text-xs text-primary">Total Used</p>
                <p className="font-semibold text-primary">
                  {totalUsed.toFixed(3)} kg
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
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
                    <AlertDialogTitle>
                      Confirm Packaging
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will record{" "}
                      {totalPackagedWeight.toFixed(3)} kg with{" "}
                      {lossValue.toFixed(3)} kg loss.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit}>
                      Confirm
                    </AlertDialogAction>
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
                      This will mark the batch as finished. Any remaining quantity (
                      {batch.remainingQuantity.toFixed(3)} kg) will be counted as
                      loss.
                      {items.length > 0 && (
                        <>
                          <br />
                          <br />
                          Any items you've added will also be saved in this
                          session.
                        </>
                      )}
                      <br />
                      <br />
                      Are you sure you want to continue?
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
