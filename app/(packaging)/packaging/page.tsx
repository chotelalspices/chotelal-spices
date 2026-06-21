"use client";

import { Fragment, useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Package, Search, Loader2, AlertCircle, Check, ChevronDown, X } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import { RecordPagination, usePaginatedRecords } from "@/components/ui/record-pagination";

interface PackagingBatch {
  batchNumber: string;
  productName: string;
  date: string | null;
  producedQuantity: number;
  alreadyPackaged: number;
  totalPackagedPackets?: number;
  semiPackagedPackets?: number;
  totalLoss: number;
  remainingQuantity: number;
  semiPackaged: number;
  status: "Not Started" | "Partial" | "Semi Packaged" | "Completed";
  sessions: unknown[];
  packagedProducts?: Array<{ name: string; packets: number; totalWeight: number }>;
  semiPackagedProducts?: Array<{ name: string; packets: number }>;
}

const ALL_STATUSES = ["Not Started", "Semi Packaged", "Partial", "Completed"] as const;
type StatusType = typeof ALL_STATUSES[number];

const formatDisplayDate = (dateString: string | null) => {
  if (!dateString) return "Not packaged";
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return dateString;
  return parsed.toLocaleDateString("en-GB");
};

const getStartOfCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
};

const normalizeSearchString = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");

const getSearchTokens = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizeSearchString)
    .filter(Boolean);

const matchesSearchTokens = (value: string, tokens: string[]) => {
  const normalizedValue = normalizeSearchString(value);
  return tokens.every((token) => normalizedValue.includes(token));
};

const matchesProductAndMasala = (
  productName: string,
  masalaName: string,
  tokens: string[]
) => {
  const normalizedMasala = normalizeSearchString(masalaName);
  const normalizedProduct = normalizeSearchString(productName);
  return tokens.every(
    (token) =>
      normalizedMasala.includes(token) || normalizedProduct.includes(token)
  );
};

const parsePackageSizeKg = (labelName: string): number | null => {
  const match = labelName.match(/(\d+(?:\.\d+)?)\s*(kg|g|gm)\b/i);
  if (!match) return null;
  const size = parseFloat(match[1]);
  if (!Number.isFinite(size)) return null;
  const unit = match[2].toLowerCase();
  return unit === "kg" ? size : size / 1000;
};

const getPacketsWeightKg = (labelName: string, packets: number, fallbackWeightKg = 0) => {
  const sizeKg = parsePackageSizeKg(labelName);
  if (sizeKg !== null) return packets * sizeKg;
  return fallbackWeightKg;
};

const getMatchingPackagedTotal = (batch: PackagingBatch, query: string) => {
  const tokens = getSearchTokens(query);
  if (tokens.length === 0) return null;

  const total = (batch.packagedProducts || [])
    .filter((product) =>
      matchesProductAndMasala(product.name, batch.productName, tokens)
    )
    .reduce(
      (sum, product) => ({
        packets: sum.packets + product.packets,
        totalWeight: sum.totalWeight + getPacketsWeightKg(product.name, product.packets, product.totalWeight),
      }),
      { packets: 0, totalWeight: 0 }
    );

  return total.totalWeight > 0 || total.packets > 0 ? total : null;
};

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
  const [packagingSearch, setPackagingSearch] = useState("");
  const [debouncedPackagingSearch, setDebouncedPackagingSearch] = useState("");
  const [expandedMasalas, setExpandedMasalas] = useState<Set<string>>(new Set());
  const [startDate, setStartDate]           = useState(getStartOfCurrentMonth);
  const [endDate, setEndDate]               = useState("");
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
    const tokens = getSearchTokens(searchQuery);
    const matchesSearch =
      tokens.length === 0 ||
      tokens.every(
        (token) =>
          batch.batchNumber.toLowerCase().includes(token) ||
          normalizeSearchString(batch.productName).includes(token) ||
          (batch.packagedProducts || []).some((product) =>
            normalizeSearchString(product.name).includes(token)
          )
      );
    const matchesStatus =
      selectedStatuses.length === 0 || selectedStatuses.includes(batch.status as StatusType);
    const batchDate = batch.date ? new Date(batch.date) : null;
    const matchesStartDate = !startDate || !batchDate || batchDate >= new Date(startDate);
    const matchesEndDate = !endDate || !batchDate || batchDate <= new Date(`${endDate}T23:59:59`);

    return matchesSearch && matchesStatus && matchesStartDate && matchesEndDate;
  });
  const batchesPagination = usePaginatedRecords(filteredBatches);
  const paginatedBatches = batchesPagination.paginatedRecords;
  const searchedPackagedTotal = searchQuery.trim()
    ? filteredBatches.reduce(
      (sum, batch) => {
        const match = getMatchingPackagedTotal(batch, searchQuery);
        return {
          packets: sum.packets + (match?.packets || 0),
          totalWeight: sum.totalWeight + (match?.totalWeight || 0),
        };
      },
      { packets: 0, totalWeight: 0 }
    )
    : { packets: 0, totalWeight: 0 };

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedPackagingSearch(packagingSearch.trim().toLowerCase()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [packagingSearch]);

  const packagingOverview = useMemo(() => {
    type PackageTotal = {
      name: string;
      fullyPackagedPackets: number;
      semiPackagedPackets: number;
      totalWeight: number;
      displayWeightKg: number;
    };
    type BatchDetail = PackagingBatch & { packageBreakdown: PackageTotal[] };
    type PackagingOverviewRow = {
      masalaName: string;
      totalQuantity: number;
      totalPackagedWeight: number;
      displayPackagedWeight: number;
      totalPackagedPackets: number;
      semiPackagedPackets: number;
      remainingQuantity: number;
      batchCount: number;
      packageBreakdown: PackageTotal[];
      batches: BatchDetail[];
    };

    const byMasala = new Map<string, PackagingOverviewRow>();

    for (const batch of batches) {
      const key = batch.productName.trim().toLowerCase();
      const row: PackagingOverviewRow = byMasala.get(key) ?? {
        masalaName: batch.productName,
        totalQuantity: 0,
        totalPackagedWeight: 0,
        displayPackagedWeight: 0,
        totalPackagedPackets: 0,
        semiPackagedPackets: 0,
        remainingQuantity: 0,
        batchCount: 0,
        packageBreakdown: [],
        batches: [],
      };
      row.totalQuantity += batch.producedQuantity;
      row.remainingQuantity += batch.remainingQuantity;
      row.batchCount += 1;

      const batchPackages = (batch.packagedProducts || [])
        .filter((product) => product.packets > 0 || product.totalWeight > 0)
        .sort((a, b) => a.name.localeCompare(b.name));

      const batchSemiPackages = (batch.semiPackagedProducts || [])
        .filter((product) => product.packets > 0)
        .sort((a, b) => a.name.localeCompare(b.name));

      const batchPackageBreakdown: PackageTotal[] = batchPackages.map((product) => ({
        name: product.name,
        fullyPackagedPackets: product.packets,
        semiPackagedPackets: 0,
        totalWeight: product.totalWeight,
        displayWeightKg: getPacketsWeightKg(product.name, product.packets, product.totalWeight),
      }));

      for (const product of batchPackages) {
        const packageKey = product.name.trim().toLowerCase();
        const existing = row.packageBreakdown.find(
          (item) => item.name.trim().toLowerCase() === packageKey,
        );
        if (existing) {
          existing.fullyPackagedPackets += product.packets;
          existing.totalWeight += product.totalWeight;
          existing.displayWeightKg += getPacketsWeightKg(product.name, product.packets, product.totalWeight);
        } else {
          row.packageBreakdown.push({
            name: product.name,
            fullyPackagedPackets: product.packets,
            semiPackagedPackets: 0,
            totalWeight: product.totalWeight,
            displayWeightKg: getPacketsWeightKg(product.name, product.packets, product.totalWeight),
          });
        }
        row.totalPackagedWeight += product.totalWeight;
        row.displayPackagedWeight += getPacketsWeightKg(product.name, product.packets, product.totalWeight);
      }

      for (const product of batchSemiPackages) {
        const semiKey = normalizeSearchString(product.name);
        const existing = row.packageBreakdown.find((item) => {
          const packageKey = normalizeSearchString(item.name);
          return packageKey.includes(semiKey) || semiKey.includes(packageKey);
        });

        if (!existing) continue;

        if (existing) {
          existing.semiPackagedPackets += product.packets;
        }
      }

      row.totalPackagedPackets += batch.totalPackagedPackets ?? batch.packagedProducts?.reduce((sum, product) => sum + product.packets, 0) ?? 0;
      row.semiPackagedPackets += row.packageBreakdown.reduce((sum, item) => sum + item.semiPackagedPackets, 0);

      for (const product of batchSemiPackages) {
        const semiKey = normalizeSearchString(product.name);
        const existing = batchPackageBreakdown.find((item) => {
          const packageKey = normalizeSearchString(item.name);
          return packageKey.includes(semiKey) || semiKey.includes(packageKey);
        });
        if (existing) {
          existing.semiPackagedPackets += product.packets;
        }
      }

      row.batches.push({ ...batch, packageBreakdown: batchPackageBreakdown });
      byMasala.set(key, row);
    }

    const searchTokens = getSearchTokens(debouncedPackagingSearch);

    return Array.from(byMasala.values())
      .map((row) => ({
        ...row,
        packageBreakdown: row.packageBreakdown.sort((a, b) => a.name.localeCompare(b.name)),
        batches: row.batches.sort((a, b) => a.batchNumber.localeCompare(b.batchNumber)),
      }))
      .filter((row) => {
        if (searchTokens.length === 0) return true;

        const masalaMatches = matchesSearchTokens(row.masalaName, searchTokens);
        const productMatches = row.packageBreakdown.some((item) =>
          matchesSearchTokens(item.name, searchTokens)
        );

        return masalaMatches || productMatches;
      })
      .sort((a, b) => a.masalaName.localeCompare(b.masalaName));
  }, [batches, debouncedPackagingSearch]);

  const overviewPagination = usePaginatedRecords(packagingOverview, 10);
  const handlePackaging    = (batchNumber: string) => router.push(`/packaging/${batchNumber}/entry`);
  const handleViewSummary  = (batchNumber: string) => router.push(`/packaging/${batchNumber}/summary`);

  const getActionButton = (batch: PackagingBatch) => {
    if (batch.status === "Completed") {
      return (
        <Button variant="outline" size="sm" className="min-w-[120px] justify-center"
          onClick={() => handleViewSummary(batch.batchNumber)}>
          View Summary
        </Button>
      );
    } else if (batch.status === "Partial" || batch.status === "Semi Packaged") {
      return (
        <div className="flex gap-2">
          <Button size="sm" className="min-w-[120px] justify-center"
            onClick={() => handlePackaging(batch.batchNumber)}>
            Continue
          </Button>
          <Button variant="outline" size="sm" className="min-w-[120px] justify-center"
            onClick={() => handleViewSummary(batch.batchNumber)}>
            View Summary
          </Button>
        </div>
      );
    }
    return (
      <Button size="sm" className="min-w-[120px] justify-center"
        onClick={() => handlePackaging(batch.batchNumber)}>
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

        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="font-semibold">360° Masala Packaging Search</h2>
              <p className="text-sm text-muted-foreground">Aggregated across every packaging batch</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Type a masala name"
                value={packagingSearch}
                onChange={(event) => setPackagingSearch(event.target.value)}
                className="pl-10"
              />
            </div>
            {packagingSearch.trim() && (
              <div className="space-y-3">
                {overviewPagination.paginatedRecords.map((row) => {
                  const isExpanded = expandedMasalas.has(row.masalaName);
                  return (
                    <Card key={row.masalaName} className="overflow-hidden">
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div>
                              <h3 className="text-lg font-semibold">{row.masalaName}</h3>
                              <p className="text-sm text-muted-foreground">
                                {row.batchCount} batches across all packaging records
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {row.packageBreakdown.length > 0 ? (
                                row.packageBreakdown.map((item) => (
                                  <Badge key={item.name} variant="secondary" className="font-normal">
                                    {item.name}: {item.fullyPackagedPackets.toLocaleString("en-IN")} full / {item.semiPackagedPackets.toLocaleString("en-IN")} semi
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-muted-foreground">No retail packages recorded</span>
                              )}
                            </div>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[360px] lg:grid-cols-3">
                            <div className="rounded-lg border bg-background p-3">
                              <p className="text-xs text-muted-foreground">Packed Weight</p>
                              <p className="mt-1 text-xl font-bold">{row.displayPackagedWeight.toFixed(3)} kg</p>
                            </div>
                            <div className="rounded-lg border bg-background p-3">
                              <p className="text-xs text-muted-foreground">Remaining</p>
                              <p className="mt-1 text-xl font-bold">{row.remainingQuantity.toFixed(3)} kg</p>
                            </div>
                            <div className="rounded-lg border bg-background p-3">
                              <p className="text-xs text-muted-foreground">Batches</p>
                              <p className="mt-1 text-xl font-bold">{row.batchCount}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedMasalas((current) => {
                              const next = new Set(current);
                              if (next.has(row.masalaName)) next.delete(row.masalaName);
                              else next.add(row.masalaName);
                              return next;
                            })}
                          >
                            Details
                            <ChevronDown className={cn("ml-1 h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                          </Button>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 space-y-4 border-t pt-4">
                            <div>
                              <h4 className="mb-2 text-sm font-semibold">Package-size totals across all batches</h4>
                              {row.packageBreakdown.length > 0 ? (
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                  {row.packageBreakdown.map((item) => (
                                    <div key={item.name} className="rounded-lg border bg-background p-3">
                                      <p className="font-medium">{item.name}</p>
                                      <div className="mt-2 space-y-1 text-sm">
                                        <p>
                                          <span className="font-semibold">Full:</span> {item.fullyPackagedPackets.toLocaleString("en-IN")} pcs
                                        </p>
                                        <p>
                                          <span className="font-semibold">Semi:</span> {item.semiPackagedPackets.toLocaleString("en-IN")} pcs
                                        </p>
                                        <p className="text-xs text-muted-foreground">{item.displayWeightKg.toFixed(3)} kg packed</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">No fully packaged retail sizes have been recorded.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {overviewPagination.totalRecords === 0 && (
                  <div className="rounded-md border py-8 text-center text-muted-foreground">
                    No masala or package size matched your search
                  </div>
                )}
                <RecordPagination {...overviewPagination} itemLabel="masalas" />
              </div>
            )}          </CardContent>
        </Card>
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

          <div className="space-y-1 w-full sm:w-auto">
            <Label className="text-xs text-muted-foreground">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full sm:w-40"
            />
          </div>

          <div className="space-y-1 w-full sm:w-auto">
            <Label className="text-xs text-muted-foreground">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full sm:w-40"
            />
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

          {(startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
            >
              Clear Dates
            </Button>
          )}
        </div>

        {searchQuery.trim() && searchedPackagedTotal.totalWeight > 0 && (
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Packaged for Search</p>
                <p className="text-sm font-medium">{searchQuery.trim()}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  {searchedPackagedTotal.totalWeight.toFixed(3)} kg
                </p>
                <p className="text-sm text-muted-foreground">
                  {searchedPackagedTotal.packets.toLocaleString("en-IN")} packets
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Desktop table ── */}
        {!isMobile && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Number</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Produced (kg)</TableHead>
                  <TableHead className="text-right">Packaged (kg)</TableHead>
                  <TableHead className="text-right">Remaining (kg)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedBatches.map((batch) => (
                  <TableRow key={batch.batchNumber}>
                    <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                    <TableCell>{batch.productName}</TableCell>
                    <TableCell>{formatDisplayDate(batch.date)}</TableCell>
                    <TableCell className="text-right">{batch.producedQuantity.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        const match = getMatchingPackagedTotal(batch, searchQuery);
                        return (
                          <div>
                            <p>{(match?.totalWeight ?? batch.alreadyPackaged).toFixed(2)}</p>
                            {match && (
                              <p className="text-xs text-muted-foreground">
                                {match.packets.toLocaleString("en-IN")} packets
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>
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
            <RecordPagination {...batchesPagination} itemLabel="batches" />
          </Card>
        )}

        {/* ── Mobile cards ── */}
        {isMobile && (
          <div className="space-y-3">
            {paginatedBatches.map((batch) => (
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
                      {(() => {
                        const match = getMatchingPackagedTotal(batch, searchQuery);
                        return (
                          <>
                            <p className="font-semibold">
                              {(match?.totalWeight ?? batch.alreadyPackaged).toFixed(2)} kg
                            </p>
                            {match && (
                              <p className="text-xs text-muted-foreground">
                                {match.packets.toLocaleString("en-IN")} packets
                              </p>
                            )}
                          </>
                        );
                      })()}
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
            <RecordPagination {...batchesPagination} itemLabel="batches" className="px-0" />
          </div>
        )}

      </div>
    </AppLayout>
  );
};

export default PackagingList;
