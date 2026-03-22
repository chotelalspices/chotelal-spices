"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Package, Search, Loader2, AlertCircle, Check, ChevronDown, X } from "lucide-react";

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
import { cn } from "@/libs/utils";
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
  semiPackaged: number;
  status: "Not Started" | "Partial" | "Semi Packaged" | "Completed";
  sessions: any[];
}

const ALL_STATUSES = ["Not Started", "Semi Packaged", "Partial", "Completed"] as const;
type StatusType = typeof ALL_STATUSES[number];

// ─── Status color helper (extended) ──────────────────────────────────────────

const getExtendedStatusColor = (status: string): string => {
  switch (status) {
    case "Completed":
      return "bg-green-50 text-white-700 border border-green-200 dark:bg-green-900/20 dark:text-white-300 dark:border-green-800";

    case "Partial":
      return "bg-blue-50 text-white-700 border border-blue-200 dark:bg-blue-900/20 dark:text-white-300 dark:border-blue-800";

    case "Semi Packaged":
      return "bg-amber-50 text-white-700 border border-amber-200 dark:bg-amber-900/20 dark:text-white-300 dark:border-amber-800";

    case "Not Started":
      return "bg-gray-50 text-white-600 border border-gray-200 dark:bg-gray-800/40 dark:text-white-300 dark:border-gray-700";

    default:
      return "bg-gray-50 text-gray-600 border border-gray-200";
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

const PackagingList = () => {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery]       = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<StatusType[]>([]);
  const [dropdownOpen, setDropdownOpen]     = useState(false);
  const [batches, setBatches]               = useState<PackagingBatch[]>([]);
  const [isLoading, setIsLoading]           = useState(true);
  const [error, setError]                   = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch packaging batches
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/packaging/batches");
        if (!response.ok) throw new Error("Failed to fetch packaging batches");
        const data = await response.json();
        setBatches(data);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load packaging batches";
        setError(errorMessage);
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchBatches();
  }, [toast]);

  const toggleStatus = (status: StatusType) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const clearFilters = () => setSelectedStatuses([]);

  // Filter batches
  const filteredBatches = batches.filter((batch) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      batch.batchNumber.toLowerCase().startsWith(query) ||
      batch.productName.toLowerCase().startsWith(query);
    const matchesStatus =
      selectedStatuses.length === 0 || selectedStatuses.includes(batch.status as StatusType);
    return matchesSearch && matchesStatus;
  });

  const handlePackaging    = (batchNumber: string) => router.push(`/packaging/${batchNumber}/entry`);
  const handleViewSummary  = (batchNumber: string) => router.push(`/packaging/${batchNumber}/summary`);

  const getActionButton = (batch: PackagingBatch) => {
  // If there's pending semi-packaged weight, always allow continuing
  if (batch.status === "Completed" && (batch.semiPackaged ?? 0) <= 0) {
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

  // ─── Loading / Error ──────────────────────────────────────────────────────

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
              <h3 className="text-lg font-semibold mb-2">Error loading batches</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products or batch numbers"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Multi-select status dropdown */}
          <div className="relative w-full sm:w-[220px]" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className={cn(
                "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                "hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                dropdownOpen && "ring-2 ring-ring ring-offset-2"
              )}
            >
              <span className="truncate text-left">
                {selectedStatuses.length === 0
                  ? "All Status"
                  : selectedStatuses.length === 1
                    ? selectedStatuses[0]
                    : `${selectedStatuses.length} selected`}
              </span>
              <ChevronDown className={cn(
                "h-4 w-4 shrink-0 opacity-50 transition-transform",
                dropdownOpen && "rotate-180"
              )} />
            </button>

            {dropdownOpen && (
              <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
                <div className="p-1">
                  {ALL_STATUSES.map((status) => {
                    const isSelected = selectedStatuses.includes(status);
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => toggleStatus(status)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          isSelected && "bg-accent/50"
                        )}
                      >
                        <div className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground"
                        )}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        {/* Color dot */}
                        <span className={cn(
                          "inline-block h-2 w-2 rounded-full shrink-0",
                          status === "Completed"     && "bg-green-300",
                          status === "Partial"       && "bg-blue-500",
                          status === "Semi Packaged" && "bg-amber-300",
                          status === "Not Started"   && "bg-gray-400",
                        )} />
                        <span>{status}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedStatuses.length > 0 && (
                  <div className="border-t border-border p-1">
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                      Clear selection
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active filter badges */}
          {selectedStatuses.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedStatuses.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className={cn("cursor-pointer gap-1 pr-1", getExtendedStatusColor(s))}
                  onClick={() => toggleStatus(s)}
                >
                  {s}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* ── Desktop table ── */}
        {!isMobile && (
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
                    <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                    <TableCell>{batch.productName}</TableCell>
                    <TableCell className="text-right">{batch.producedQuantity.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{batch.alreadyPackaged.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {batch.remainingQuantity.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getExtendedStatusColor(batch.status)}
                      >
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
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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

        {/* ── Mobile cards ── */}
        {isMobile && (
          <div className="space-y-3">
            {filteredBatches.map((batch) => (
              <Card key={batch.batchNumber}>
                <CardContent className="p-4">
                  <div className="flex justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{batch.productName}</h3>
                      <p className="text-sm text-muted-foreground">{batch.batchNumber}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={getExtendedStatusColor(batch.status)}
                    >
                      {batch.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">Produced</p>
                      <p className="font-semibold">{batch.producedQuantity} kg</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">Packaged</p>
                      <p className="font-semibold">{batch.alreadyPackaged} kg</p>
                    </div>
                    {batch.semiPackaged > 0 && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 text-center">
                        <p className="text-xs text-orange-600 dark:text-orange-400">Semi-Packaged</p>
                        <p className="font-semibold text-orange-700 dark:text-orange-300">
                          {batch.semiPackaged.toFixed(3)} kg
                        </p>
                      </div>
                    )}
                    <div className={cn(
                      "bg-primary/10 rounded-lg p-2 text-center",
                      batch.semiPackaged > 0 ? "" : "col-span-1"
                    )}>
                      <p className="text-xs text-primary">Remaining</p>
                      <p className="font-semibold text-primary">{batch.remainingQuantity} kg</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {getActionButton(batch)}
                    {(batch.status === "Partial" || batch.status === "Semi Packaged") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewSummary(batch.batchNumber)}
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
        )}

      </div>
    </AppLayout>
  );
};

export default PackagingList;