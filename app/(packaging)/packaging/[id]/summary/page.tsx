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
  Check,
  X,
  Pencil,
  Tag,
  Box,
  RefreshCw,
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
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { getStatusColor } from "@/data/packagingData";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionLabel {
  type: string;
  quantity: number;
  boxTypeId?: string;
  boxesUsed?: number;
  semiPackaged?: boolean;
}

interface SessionCourierBox {
  id: string;
  label: string;
  itemsPerBox: number;
  boxesNeeded: number;
  totalPackets: number;
}

interface ProductLabel {
  type: string;
  quantity: number;
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

interface PackagingSession {
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
  semiPackaged?: number;
  remarks?: string;
  performedBy: string;
  labels?: SessionLabel[];
  courierBoxes?: SessionCourierBox[];
  // Box type deductions stored per session
  boxTypeDeductions?: Array<{ boxTypeId: string; boxTypeName: string; boxesUsed: number }>;
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
  sessions: PackagingSession[];
  semiPackaged: number;
  semiPackagedLabels?: Array<{ type: string; quantity: number }>;
}

interface BoxTypeInfo {
  id: string;
  name: string;
  availableStock: number;
}

// ─── Session type helpers ─────────────────────────────────────────────────────

type SessionType = "semi" | "conversion" | "full";

const getSessionType = (session: PackagingSession): SessionType => {
  if (session.remarks?.includes("Semi Packaging Session")) return "semi";
  if (session.remarks?.includes("(conversion)")) return "conversion";
  return "full";
};

const SESSION_TYPE_CONFIG: Record<
  SessionType,
  { label: string; badgeClass: string; rowClass: string }
> = {
  semi: {
    label: "Semi-Packaged",
    badgeClass: "text-white-700 border-orange-300 bg-orange-50 dark:bg-orange-900/20 dark:text-white-300",
    rowClass: "bg-orange-50/40 dark:bg-orange-900/10",
  },
  conversion: {
    label: "Converted → Full",
    badgeClass: "text-primary border-primary/30 bg-primary/5",
    rowClass: "bg-primary/5 dark:bg-primary/10",
  },
  full: {
    label: "Fully Packaged",
    badgeClass: "text-white-700 border-green-300 bg-green-50 dark:bg-green-900/20 dark:text-white-300",
    rowClass: "",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isCourierBoxLabel = (name: string) => name.toLowerCase().includes("courier box");

const parseProductsFromRemarks = (remarks?: string) => {
  if (!remarks) return [];
  const products: Array<{ name: string; packets: number; weight: number }> = [];
  const productMatches = remarks.match(/([^:]+): (\d+) packets \(([\d.]+)kg\)/g);
  if (productMatches) {
    productMatches.forEach((match) => {
      const parts = match.match(/([^:]+): (\d+) packets \(([\d.]+)kg\)/);
      if (parts) {
        products.push({
          name: parts[1].trim(),
          packets: parseInt(parts[2]),
          weight: parseFloat(parts[3]),
        });
      }
    });
  }
  return products;
};

const getBoxCount = (
  sessionLabels: SessionLabel[],
  labelType: string,
  products: Product[]
): number | null => {
  const label = sessionLabels.find((l) => l.type === labelType);
  if (!label) return null;
  // If boxesUsed is stored directly, prefer it
  if (label.boxesUsed !== undefined && label.boxesUsed > 0) return label.boxesUsed;
  for (const p of products) {
    const pl = p.labels.find((l) => l.type === labelType);
    if (pl && pl.quantity > 0) return Math.ceil(label.quantity / pl.quantity);
  }
  return label.quantity;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SessionTypeBadge = ({ type }: { type: SessionType }) => {
  const config = SESSION_TYPE_CONFIG[type];
  return (
    <Badge variant="outline" className={`text-[10px] ${config.badgeClass}`}>
      {type === "semi" && <Package className="h-2.5 w-2.5 mr-1" />}
      {type === "conversion" && <RefreshCw className="h-2.5 w-2.5 mr-1" />}
      {type === "full" && <PackageCheck className="h-2.5 w-2.5 mr-1" />}
      {config.label}
    </Badge>
  );
};

const LabelsDisplay = ({ labels, sessionType }: { labels?: SessionLabel[]; sessionType: SessionType }) => {
  if (!labels || labels.length === 0) return null;
  const filtered = sessionType === "semi"
    ? labels.filter((l) => l.semiPackaged)
    : labels.filter((l) => !l.semiPackaged);
  if (filtered.length === 0) return null;
  return (
    <div className="flex items-start gap-2 mt-2">
      <Tag className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex flex-wrap gap-1">
        {filtered.map((l, i) => (
          <Badge key={i} variant="outline" className="text-xs">
            {l.type}: {l.quantity}
          </Badge>
        ))}
      </div>
    </div>
  );
};

// Box type deductions display used in mobile cards and desktop table
const BoxTypeDeductionsDisplay = ({
  session,
  sessionType,
  boxTypesMap,
}: {
  session: PackagingSession;
  sessionType: SessionType;
  boxTypesMap: Map<string, BoxTypeInfo>;
}) => {
  if (sessionType === "semi") return null;

  // Build deduction list from boxTypeDeductions (if stored) OR from labels
  const deductions: Array<{ name: string; boxes: number }> = [];

  if (session.boxTypeDeductions && session.boxTypeDeductions.length > 0) {
    session.boxTypeDeductions.forEach((d) => {
      deductions.push({ name: d.boxTypeName || boxTypesMap.get(d.boxTypeId)?.name || d.boxTypeId, boxes: d.boxesUsed });
    });
  } else if (session.labels) {
    // Fallback: aggregate from labels
    const seen = new Map<string, number>();
    session.labels
      .filter((l) => !l.semiPackaged && l.boxTypeId && (l.boxesUsed ?? 0) > 0)
      .forEach((l) => {
        const name = boxTypesMap.get(l.boxTypeId!)?.name ?? l.boxTypeId!;
        seen.set(name, (seen.get(name) ?? 0) + (l.boxesUsed ?? 0));
      });
    seen.forEach((boxes, name) => deductions.push({ name, boxes }));
  }

  if (deductions.length === 0) return null;

  return (
    <div className="flex items-start gap-2 mt-2">
      <Box className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
      <div className="flex flex-wrap gap-1">
        {deductions.map((d, i) => (
          <Badge key={i} variant="outline" className="text-xs border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/20">
            {d.name}: {d.boxes} boxes
          </Badge>
        ))}
      </div>
    </div>
  );
};

const CourierBoxDisplay = ({ courierBoxes }: { courierBoxes?: SessionCourierBox[] }) => {
  const box = courierBoxes?.[0];
  if (!box) return null;
  return (
    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
      <Box className="h-3.5 w-3.5 shrink-0" />
      <span>
        <span className="font-medium text-foreground">{box.boxesNeeded} boxes</span>
        {box.label && <span> ({box.label})</span>}
        <span> · {box.itemsPerBox} packets/box · {box.totalPackets} total packets</span>
      </span>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PackagingSummary = () => {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const batchNumber = params.id;
  const { toast } = useToast();

  const isMobile = useIsMobile();
  const [batch, setBatch] = useState<PackagingBatch | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [boxTypesMap, setBoxTypesMap] = useState<Map<string, BoxTypeInfo>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editedDate, setEditedDate] = useState("");
  const [isSavingDate, setIsSavingDate] = useState(false);

  useEffect(() => {
    const fetchBatch = async () => {
      if (!batchNumber) return;
      try {
        setIsLoading(true);
        setError(null);

        const [batchRes, boxTypesRes] = await Promise.all([
          fetch(`/api/packaging/batches/${encodeURIComponent(batchNumber)}`),
          fetch("/api/box-inventory"),
        ]);

        if (!batchRes.ok) {
          throw new Error(batchRes.status === 404 ? "Batch not found" : "Failed to fetch packaging batch");
        }
        const data: PackagingBatch = await batchRes.json();
        setBatch(data);

        // Build box types map for name lookups
        if (boxTypesRes.ok) {
          const boxTypesData: BoxTypeInfo[] = await boxTypesRes.json();
          const map = new Map<string, BoxTypeInfo>();
          boxTypesData.forEach((b) => map.set(b.id, b));
          setBoxTypesMap(map);
        }

        if (data.formulationId) {
          const productsRes = await fetch(`/api/formulations/${data.formulationId}/products/packaging`);
          if (productsRes.ok) {
            const productsData: Product[] = await productsRes.json();
            setProducts(productsData);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load packaging batch";
        setError(errorMessage);
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchBatch();
  }, [batchNumber, toast]);

  const startEditingDate = (sessionId: string, currentDate: string) => {
    setEditingSessionId(sessionId);
    setEditedDate(new Date(currentDate).toISOString().split("T")[0]);
  };

  const cancelEditingDate = () => {
    setEditingSessionId(null);
    setEditedDate("");
  };

  const saveDate = async (sessionId: string) => {
    if (!editedDate) {
      toast({ title: "Error", description: "Please select a valid date", variant: "destructive" });
      return;
    }
    try {
      setIsSavingDate(true);
      const response = await fetch(`/api/packaging/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editedDate }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to update date");
      }
      if (batch) {
        setBatch({
          ...batch,
          sessions: batch.sessions.map((s) =>
            s.id === sessionId ? { ...s, date: new Date(editedDate).toISOString() } : s
          ),
        });
      }
      toast({ title: "Date updated", description: "Packaging session date updated successfully" });
      setEditingSessionId(null);
      setEditedDate("");
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to update date", variant: "destructive" });
    } finally {
      setIsSavingDate(false);
    }
  };

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
          <p className="text-muted-foreground mb-4">{error || "The requested batch could not be found."}</p>
          <Button className="h-11 min-w-[200px] justify-center" onClick={() => router.push("/packaging")}>
            Back to Packaging
          </Button>
        </div>
      </AppLayout>
    );
  }

  const displaySessions = [...batch.sessions]
    .reverse()
    .filter((s) => {
      const sessionType = getSessionType(s);
      if (sessionType === "semi") return (s.semiPackaged ?? 0) > 0;
      return (
        s.totalPackagedWeight > 0 ||
        (s.labels && s.labels.filter((l) => !l.semiPackaged).length > 0) ||
        (s.courierBoxes && s.courierBoxes.length > 0)
      );
    });

  const summaryItems = [
    { label: "Total Produced", value: `${batch.producedQuantity.toFixed(2)} kg`, icon: Boxes, color: "bg-muted/50 text-foreground" },
    { label: "Total Packaged", value: `${batch.alreadyPackaged.toFixed(2)} kg`, icon: PackageCheck, color: "bg-green-100 text-black dark:bg-green-900/30 dark:text-black" },
    { label: "Total Loss", value: `${batch.totalLoss.toFixed(3)} kg`, icon: AlertTriangle, color: "bg-amber-100 text-black dark:bg-amber-900/30 dark:text-black" },
    { label: "Remaining", value: `${batch.remainingQuantity.toFixed(2)} kg`, icon: Package, color: "bg-primary/10 text-primary" },
  ];

  if (batch.semiPackaged > 0) {
    summaryItems.splice(3, 0, {
      label: "Semi-Packaged",
      value: `${batch.semiPackaged.toFixed(2)} kg`,
      icon: Package,
      color: "bg-orange-100 text-white-800 dark:bg-orange-900/30 dark:text-white-300",
    });
  }

  const completionPercent = Math.min(
    100,
    ((batch.alreadyPackaged + batch.semiPackaged) / batch.producedQuantity) * 100
  );

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/packaging")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Packaging Summary</h1>
              <Badge className={getStatusColor(batch.status)}>{batch.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{batch.productName} • {batch.batchNumber}</p>
          </div>
          {batch.status !== "Completed" && (
            <Button className="h-11 min-w-[200px] justify-center" onClick={() => router.push(`/packaging/${batchNumber}/entry`)}>
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
                  <span className="text-xs font-medium">{item.label}</span>
                </div>
                <p className="text-xl font-bold">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Packaging Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Completion</span>
              <span className="font-medium">{completionPercent.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full flex">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (batch.alreadyPackaged / batch.producedQuantity) * 100)}%` }}
                />
                {batch.semiPackaged > 0 && (
                  <div
                    className="h-full bg-orange-400 transition-all"
                    style={{
                      width: `${Math.min(
                        100 - (batch.alreadyPackaged / batch.producedQuantity) * 100,
                        (batch.semiPackaged / batch.producedQuantity) * 100
                      )}%`,
                    }}
                  />
                )}
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0 kg</span>
              {batch.semiPackaged > 0 && (
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />
                  {batch.semiPackaged.toFixed(2)} kg semi-packaged
                </span>
              )}
              <span>{batch.producedQuantity} kg</span>
            </div>
          </CardContent>
        </Card>

        {/* Packaging History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Packaging History</CardTitle>
          </CardHeader>
          <CardContent>
            {displaySessions.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No packaging sessions yet</p>
              </div>
            ) : isMobile ? (
              /* ── Mobile cards ── */
              <div className="space-y-4">
                {displaySessions.map((session) => {
                  const sessionType = getSessionType(session);
                  const config = SESSION_TYPE_CONFIG[sessionType];
                  return (
                    <Card key={session.id} className={`${config.rowClass} border`}>
                      <CardContent className="p-4">
                        <div className="mb-3">
                          <SessionTypeBadge type={sessionType} />
                        </div>

                        {/* Date + performer */}
                        <div className="flex justify-between items-center mb-3 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {editingSessionId === session.id ? (
                              <div className="flex items-center gap-1">
                                <Input type="date" value={editedDate} onChange={(e) => setEditedDate(e.target.value)} className="h-7 w-32 text-xs" disabled={isSavingDate} />
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveDate(session.id)} disabled={isSavingDate}>
                                  {isSavingDate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-600" />}
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEditingDate} disabled={isSavingDate}>
                                  <X className="h-3.5 w-3.5 text-red-600" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <span>{format(new Date(session.date), "dd MMM yyyy")}</span>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditingDate(session.id, session.date)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {session.performedBy}
                          </div>
                        </div>

                        {/* Products */}
                        {sessionType !== "semi" && (
                          <div className="space-y-2 mb-3">
                            {parseProductsFromRemarks(session.remarks).map((product, index) => (
                              <div key={index} className="flex justify-between text-sm bg-background rounded-lg p-2">
                                <span>{product.name} × {product.packets}</span>
                                <span className="font-medium">{product.weight.toFixed(3)} kg</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Weight display */}
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className={sessionType === "semi" ? "bg-orange-100 dark:bg-orange-900/30 rounded-lg p-2 text-center" : "bg-green-100 dark:bg-green-900/30 rounded-lg p-2 text-center"}>
                            <p className="text-xs">{sessionType === "semi" ? "Semi-Packaged" : "Packaged"}</p>
                            <p className="font-semibold">
                              {sessionType === "semi" ? `${(session.semiPackaged ?? 0).toFixed(3)} kg` : `${session.totalPackagedWeight.toFixed(3)} kg`}
                            </p>
                          </div>
                          <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-2 text-center">
                            <p className="text-xs">Loss</p>
                            <p className="font-semibold">{session.packagingLoss.toFixed(3)} kg</p>
                          </div>
                        </div>

                        {/* Labels */}
                        <LabelsDisplay labels={session.labels} sessionType={sessionType} />

                        {/* Box type deductions */}
                        <BoxTypeDeductionsDisplay session={session} sessionType={sessionType} boxTypesMap={boxTypesMap} />

                        {/* Courier box */}
                        {sessionType !== "semi" && <CourierBoxDisplay courierBoxes={session.courierBoxes} />}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              /* ── Desktop table ── */
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Labels</TableHead>
                    <TableHead>Boxes Used</TableHead>
                    <TableHead className="text-right">Weight (kg)</TableHead>
                    <TableHead className="text-right">Loss (kg)</TableHead>
                    <TableHead>Performed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displaySessions.map((session) => {
                    const sessionType = getSessionType(session);
                    const config = SESSION_TYPE_CONFIG[sessionType];

                    // Build box type deductions for this session
                    const boxDeductions: Array<{ name: string; boxes: number; forLabel?: string }> = [];
                    if (session.boxTypeDeductions && session.boxTypeDeductions.length > 0) {
                      session.boxTypeDeductions.forEach((d) => {
                        boxDeductions.push({
                          name: d.boxTypeName || boxTypesMap.get(d.boxTypeId)?.name || d.boxTypeId,
                          boxes: d.boxesUsed,
                        });
                      });
                    } else if (session.labels) {
                      const seen = new Map<string, { boxes: number; forLabel: string }>();
                      session.labels
                        .filter((l) => !l.semiPackaged && l.boxTypeId && (l.boxesUsed ?? 0) > 0)
                        .forEach((l) => {
                          const name = boxTypesMap.get(l.boxTypeId!)?.name ?? l.boxTypeId!;
                          const existing = seen.get(name);
                          seen.set(name, {
                            boxes: (existing?.boxes ?? 0) + (l.boxesUsed ?? 0),
                            forLabel: existing?.forLabel ? `${existing.forLabel}, ${l.type}` : l.type,
                          });
                        });
                      seen.forEach((val, name) => boxDeductions.push({ name, boxes: val.boxes, forLabel: val.forLabel }));
                    }

                    return (
                      <TableRow key={session.id} className={config.rowClass}>

                        {/* Date */}
                        <TableCell>
                          {editingSessionId === session.id ? (
                            <div className="flex items-center gap-1">
                              <Input type="date" value={editedDate} onChange={(e) => setEditedDate(e.target.value)} className="h-8 w-36" disabled={isSavingDate} />
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveDate(session.id)} disabled={isSavingDate}>
                                {isSavingDate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEditingDate} disabled={isSavingDate}>
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>{format(new Date(session.date), "dd MMM yyyy")}</span>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditingDate(session.id, session.date)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </TableCell>

                        {/* Type */}
                        <TableCell><SessionTypeBadge type={sessionType} /></TableCell>

                        {/* Products */}
                        <TableCell>
                          {sessionType !== "semi" ? (
                            <div className="flex flex-wrap gap-1">
                              {parseProductsFromRemarks(session.remarks).map((product, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {product.name} × {product.packets}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>

                        {/* Labels */}
                        <TableCell>
                          {(() => {
                            const relevant = sessionType === "semi"
                              ? (session.labels ?? []).filter((l) => l.semiPackaged)
                              : (session.labels ?? []).filter((l) => !l.semiPackaged);
                            return relevant.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {relevant.map((l, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {l.type}: {l.quantity}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            );
                          })()}
                        </TableCell>

                        {/* Boxes Used — label boxes + box type deductions */}
                        <TableCell>
                          {sessionType !== "semi" ? (
                            <div className="flex flex-col gap-1">
                              {/* Per-label box counts */}
                              {session.labels &&
                                session.labels
                                  .filter((l) => !isCourierBoxLabel(l.type) && !l.semiPackaged)
                                  .map((l, i) => {
                                    const boxes = getBoxCount(session.labels!, l.type, products);
                                    return (
                                      <div key={i} className="flex items-center gap-1 text-sm">
                                        <Box className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span className="font-medium">
                                          {boxes !== null ? boxes.toLocaleString("en-IN") : l.quantity.toLocaleString("en-IN")}
                                        </span>
                                        <span className="text-muted-foreground text-xs">boxes · {l.type}</span>
                                      </div>
                                    );
                                  })}

                              {/* Box type deductions */}
                              {boxDeductions.map((d, i) => (
                                <div key={`bt-${i}`} className="flex items-center gap-1 text-sm">
                                  <Box className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  <span className="font-medium text-blue-700 dark:text-blue-300">
                                    {d.boxes.toLocaleString("en-IN")}
                                  </span>
                                  <span className="text-muted-foreground text-xs">
                                    {d.name}
                                    {d.forLabel && <span className="ml-1 text-[10px]">({d.forLabel})</span>}
                                  </span>
                                </div>
                              ))}

                              {/* Courier boxes */}
                              {session.courierBoxes && session.courierBoxes.length > 0 && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Box className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span className="font-medium">{session.courierBoxes[0].boxesNeeded.toLocaleString("en-IN")}</span>
                                  <span className="text-muted-foreground text-xs">
                                    boxes · {session.courierBoxes[0].label || "courier box"}{" "}
                                    · {session.courierBoxes[0].itemsPerBox}/box
                                  </span>
                                </div>
                              )}

                              {(!session.labels || session.labels.filter((l) => !isCourierBoxLabel(l.type) && !l.semiPackaged).length === 0) &&
                                (!session.courierBoxes || session.courierBoxes.length === 0) &&
                                boxDeductions.length === 0 && (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>

                        {/* Weight */}
                        <TableCell className="text-right font-medium">
                          {sessionType === "semi" ? (
                            <span className="text-orange-600 dark:text-orange-400">
                              {(session.semiPackaged ?? 0).toFixed(3)}
                            </span>
                          ) : (
                            session.totalPackagedWeight.toFixed(3)
                          )}
                        </TableCell>

                        {/* Loss */}
                        <TableCell className="text-right text-amber-600 dark:text-amber-400">
                          {session.packagingLoss.toFixed(3)}
                        </TableCell>

                        {/* Performer */}
                        <TableCell>{session.performedBy}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" className="h-11 min-w-[200px]" onClick={() => router.push("/packaging")}>
            Back to Batches
          </Button>
          {batch.status !== "Completed" && (
            <Button className="h-11 min-w-[200px]" onClick={() => router.push(`/packaging/${batchNumber}/entry`)}>
              Continue Packaging
            </Button>
          )}
        </div>

      </div>
    </AppLayout>
  );
};

export default PackagingSummary;