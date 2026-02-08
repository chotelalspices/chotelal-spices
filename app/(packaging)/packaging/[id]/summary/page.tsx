"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Package,
  ArrowLeft,
  Calendar,
  User,
  PackageCheck,
  AlertTriangle,
  Boxes,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

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
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { getStatusColor } from "@/data/packagingData";

interface PackagingBatch {
  batchNumber: string;
  productName: string;
  producedQuantity: number;
  alreadyPackaged: number;
  totalLoss: number;
  remainingQuantity: number;
  status: "Not Started" | "Partial" | "Completed";
  sessions: Array<{
    id: string;
    batchNumber: string;
    date: string;
    items: Array<{
      containerId: string;
      containerSize: number;
      containerLabel: string;
      numberOfPackets: number;
      totalWeight: number;
    }>;
    packagingLoss: number;
    totalPackagedWeight: number;
    remarks?: string;
    performedBy: string;
  }>;
}

// Helper function to parse product details from remarks
const parseProductsFromRemarks = (remarks?: string) => {
  if (!remarks) return [];
  
  const products: Array<{
    name: string;
    packets: number;
    weight: number;
  }> = [];
  
  // Look for pattern like "Garlic Paste 100g: 1000 packets (100kg)"
  const productMatches = remarks.match(/([^:]+): (\d+) packets \(([\d.]+)kg\)/g);
  
  if (productMatches) {
    productMatches.forEach(match => {
      const parts = match.match(/([^:]+): (\d+) packets \(([\d.]+)kg\)/);
      if (parts) {
        products.push({
          name: parts[1].trim(),
          packets: parseInt(parts[2]),
          weight: parseFloat(parts[3])
        });
      }
    });
  }
  
  return products;
};

const PackagingSummary = () => {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const batchNumber = params.id;
  const { toast } = useToast();

  const isMobile = useIsMobile();
  const [batch, setBatch] = useState<PackagingBatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBatch = async () => {
      if (!batchNumber) return;

      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(
          `/api/packaging/batches/${encodeURIComponent(batchNumber)}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Batch not found");
          }
          throw new Error("Failed to fetch packaging batch");
        }

        const data = await response.json();
        setBatch(data);
      } catch (error) {
        console.error("Error fetching packaging batch:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to load packaging batch";
        setError(errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatch();
  }, [batchNumber, toast]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading batch details...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !batch) {
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

  const summaryItems = [
    {
      label: "Total Produced",
      value: `${batch.producedQuantity.toFixed(2)} kg`,
      icon: Boxes,
      color: "bg-muted/50 text-foreground",
    },
    {
      label: "Total Packaged",
      value: `${batch.alreadyPackaged.toFixed(2)} kg`,
      icon: PackageCheck,
      color:
        "bg-green-100 text-black dark:bg-green-900/30 dark:text-black",
    },
    {
      label: "Total Loss",
      value: `${batch.totalLoss.toFixed(3)} kg`,
      icon: AlertTriangle,
      color:
        "bg-amber-100 text-black dark:bg-amber-900/30 dark:text-black",
    },
    {
      label: "Remaining",
      value: `${batch.remainingQuantity.toFixed(2)} kg`,
      icon: Package,
      color: "bg-primary/10 text-primary",
    },
  ];

  const completionPercent =
    (batch.alreadyPackaged / batch.producedQuantity) * 100;

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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Packaging Summary</h1>
              <Badge className={getStatusColor(batch.status)}>
                {batch.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {batch.productName} • {batch.batchNumber}
            </p>
          </div>

          {batch.status !== "Completed" && (
            <Button
              className="h-11 min-w-[200px] justify-center"
              onClick={() =>
                router.push(`/packaging/${batchNumber}/entry`)
              }
            >
              Continue Packaging
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summaryItems.map((item) => (
            <Card key={item.label}>
              <CardContent className={`p-4 ${item.color}`}>
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className="h-4 w-4" />
                  <span className="text-xs font-medium">
                    {item.label}
                  </span>
                </div>
                <p className="text-xl font-bold">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Packaging Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Completion</span>
              <span className="font-medium">
                {completionPercent.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0 kg</span>
              <span>{batch.producedQuantity} kg</span>
            </div>
          </CardContent>
        </Card>

        {/* Packaging History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Packaging History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {batch.sessions.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  No packaging sessions yet
                </p>
              </div>
            ) : isMobile ? (
              <div className="space-y-4">
                {batch.sessions.map((session) => (
                  <Card key={session.id} className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex justify-between mb-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {format(
                            new Date(session.date),
                            "dd MMM yyyy"
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {session.performedBy}
                        </div>
                      </div>

                      <div className="space-y-2 mb-3">
                        {parseProductsFromRemarks(session.remarks).map((product, index) => (
                          <div
                            key={index}
                            className="flex justify-between text-sm bg-background rounded-lg p-2"
                          >
                            <span>
                              {product.name} × {product.packets}
                            </span>
                            <span className="font-medium">
                              {product.weight.toFixed(3)} kg
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-2 text-center">
                          <p className="text-xs">Packaged</p>
                          <p className="font-semibold">
                            {session.totalPackagedWeight.toFixed(3)} kg
                          </p>
                        </div>
                        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-2 text-center">
                          <p className="text-xs">Loss</p>
                          <p className="font-semibold">
                            {session.packagingLoss.toFixed(3)} kg
                          </p>
                        </div>
                      </div>

                      {session.remarks && (
                        <p className="text-sm text-muted-foreground mt-3 italic">
                          "{session.remarks}"
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead className="text-right">
                      Packaged Weight
                    </TableHead>
                    <TableHead className="text-right">
                      Loss
                    </TableHead>
                    <TableHead>Performed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batch.sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        {format(
                          new Date(session.date),
                          "dd MMM yyyy"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {parseProductsFromRemarks(session.remarks).map((product, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="text-xs"
                            >
                              {product.name} × {product.packets}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {session.totalPackagedWeight.toFixed(3)} kg
                      </TableCell>
                      <TableCell className="text-right text-amber-600 dark:text-amber-400">
                        {session.packagingLoss.toFixed(3)} kg
                      </TableCell>
                      <TableCell>
                        {session.performedBy}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="h-11 min-w-[200px]"
            onClick={() => router.push("/packaging")}
          >
            Back to Batches
          </Button>

          {batch.status !== "Completed" && (
            <Button
              className="h-11 min-w-[200px]"
              onClick={() =>
                router.push(`/packaging/${batchNumber}/entry`)
              }
            >
              Continue Packaging
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default PackagingSummary;
