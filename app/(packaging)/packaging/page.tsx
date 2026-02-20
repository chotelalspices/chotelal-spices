"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Package, Search, Loader2, AlertCircle } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  sessions: any[];
}

const PackagingList = () => {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [batches, setBatches] = useState<PackagingBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch packaging batches from API
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/packaging/batches");

        if (!response.ok) {
          throw new Error("Failed to fetch packaging batches");
        }

        const data = await response.json();
        setBatches(data);
      } catch (error) {
        console.error("Error fetching packaging batches:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to load packaging batches";
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

    fetchBatches();
  }, [toast]);

  // ── UPDATED: Prefix-based search filter ──
  const filteredBatches = batches.filter((batch) => {
    const query = searchQuery.toLowerCase().trim();
    
    // If search is empty, show all (respecting status filter)
    if (!query) {
      const matchesStatus = statusFilter === "all" || batch.status === statusFilter;
      return matchesStatus;
    }

    // Check if batch number OR product name STARTS WITH the query
    const batchNumberMatch = batch.batchNumber.toLowerCase().startsWith(query);
    const productNameMatch = batch.productName.toLowerCase().startsWith(query);
    
    const matchesSearch = batchNumberMatch || productNameMatch;
    const matchesStatus = statusFilter === "all" || batch.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handlePackaging = (batchNumber: string) => {
    router.push(`/packaging/${batchNumber}/entry`);
  };

  const handleViewSummary = (batchNumber: string) => {
    router.push(`/packaging/${batchNumber}/summary`);
  };

  const getActionButton = (batch: PackagingBatch) => {
    if (batch.status === "Completed") {
      return (
        <Button
          variant="outline"
          size="sm"
          className="min-w-[120px] justify-center"
          onClick={() => handleViewSummary(batch.batchNumber)}
        >
          View Summary
        </Button>
      );
    }

    return (
      <Button
        size="sm"
        className="min-w-[120px] justify-center"
        onClick={() => handlePackaging(batch.batchNumber)}
      >
        {batch.status === "Not Started" ? "Start" : "Continue"}
      </Button>
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading packaging batches...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && batches.length === 0) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Error loading batches
              </h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Packaging</h1>
              <p className="text-sm text-muted-foreground">
                Convert bulk production into retail packets
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Not Started">Not Started</SelectItem>
              <SelectItem value="Partial">Partial</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {isMobile ? (
          <div className="space-y-3">
            {filteredBatches.map((batch) => (
              <Card key={batch.batchNumber}>
                <CardContent className="p-4">
                  <div className="flex justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{batch.productName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {batch.batchNumber}
                      </p>
                    </div>
                    <Badge className={getStatusColor(batch.status)}>
                      {batch.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">Produced</p>
                      <p className="font-semibold">
                        {batch.producedQuantity} kg
                      </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">Packaged</p>
                      <p className="font-semibold">
                        {batch.alreadyPackaged} kg
                      </p>
                    </div>
                    <div className="bg-primary/10 rounded-lg p-2 text-center">
                      <p className="text-xs text-primary">Remaining</p>
                      <p className="font-semibold text-primary">
                        {batch.remainingQuantity} kg
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {getActionButton(batch)}
                    {batch.status === "Partial" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleViewSummary(batch.batchNumber)
                        }
                      >
                        History
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredBatches.length === 0 && batches.length > 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No batches match your filters
              </div>
            )}
            {batches.length === 0 && !isLoading && (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No packaging batches</h3>
                <p className="text-muted-foreground">
                  Create a production batch to get started with packaging
                </p>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Number</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="text-right">Produced (kg)</TableHead>
                  <TableHead className="text-right">Packaged (kg)</TableHead>
                  <TableHead className="text-right">Remaining (kg)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredBatches.map((batch) => (
                  <TableRow key={batch.batchNumber}>
                    <TableCell className="font-medium">
                      {batch.batchNumber}
                    </TableCell>
                    <TableCell>{batch.productName}</TableCell>
                    <TableCell className="text-right">
                      {batch.producedQuantity.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {batch.alreadyPackaged.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {batch.remainingQuantity.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(batch.status)}>
                        {batch.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {getActionButton(batch)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {filteredBatches.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      {batches.length === 0
                        ? "No packaging batches available"
                        : "No batches match your filters"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default PackagingList;