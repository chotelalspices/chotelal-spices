'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Edit, Loader2, AlertCircle, Download, ChevronDown, ChevronUp,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/data/sampleData';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/libs/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormulationIngredient {
  rawMaterialId: string;
  rawMaterialName: string;
  rawMaterialUnit: 'kg' | 'gm';
  rawMaterialCostPerUnit: number;
  percentage: number;
}

interface Formulation {
  id: string;
  name: string;
  baseQuantity: number;
  baseUnit: 'kg' | 'gm';
  status: 'active' | 'inactive';
  ingredients: FormulationIngredient[];
  createdAt: string;
  updatedAt: string;
  auditLogs?: AuditLog[];
}

// Each audit log stores the full snapshot of the formulation BEFORE that edit
interface AuditSnapshot {
  name: string;
  baseQuantity: number;
  baseUnit: 'kg' | 'gm';
  status: 'active' | 'inactive';
  ingredients: FormulationIngredient[];
}

interface AuditLog {
  id: string;
  changedAt: string;
  changedBy?: { fullName: string } | null;
  changes: AuditSnapshot;
}

interface CalculatedIngredient {
  rawMaterialName: string;
  percentage: number;
  quantity: number;
  unit: 'kg' | 'gm';
  ratePerUnit: number;
  costContribution: number;
}

// ─── Helper: calculate ingredients from a snapshot ───────────────────────────

const calculateIngredients = (
  ingredients: FormulationIngredient[],
  baseQuantity: number,
  baseUnit: 'kg' | 'gm'
): { rows: CalculatedIngredient[]; totalCost: number; costPerKg: number; totalPercentage: number } => {
  let totalCost = 0;
  let totalPercentage = 0;

  const rows: CalculatedIngredient[] = ingredients.map((ingredient) => {
    totalPercentage += ingredient.percentage;
    const quantity = (ingredient.percentage / 100) * baseQuantity;

    let costContribution: number;
    if (baseUnit === ingredient.rawMaterialUnit) {
      costContribution = quantity * ingredient.rawMaterialCostPerUnit;
    } else if (baseUnit === 'kg' && ingredient.rawMaterialUnit === 'gm') {
      costContribution = quantity * 1000 * ingredient.rawMaterialCostPerUnit;
    } else {
      costContribution = (quantity / 1000) * ingredient.rawMaterialCostPerUnit;
    }

    totalCost += costContribution;

    return {
      rawMaterialName: ingredient.rawMaterialName,
      percentage: ingredient.percentage,
      quantity,
      unit: baseUnit,
      ratePerUnit: ingredient.rawMaterialCostPerUnit,
      costContribution,
    };
  });

  const baseInKg = baseUnit === 'kg' ? baseQuantity : baseQuantity / 1000;
  const costPerKg = baseInKg > 0 ? totalCost / baseInKg : 0;

  return { rows, totalCost, costPerKg, totalPercentage };
};

// ─── Breakdown table component ────────────────────────────────────────────────

const BreakdownTable = ({
  ingredients,
  baseQuantity,
  baseUnit,
}: {
  ingredients: FormulationIngredient[];
  baseQuantity: number;
  baseUnit: 'kg' | 'gm';
}) => {
  const { rows, totalCost, costPerKg } = calculateIngredients(ingredients, baseQuantity, baseUnit);

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Percentage</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Rate per Unit</TableHead>
            <TableHead className="text-right">Cost Contribution</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((ing, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{ing.rawMaterialName}</TableCell>
              <TableCell>{ing.percentage.toFixed(2)}%</TableCell>
              <TableCell>{ing.quantity.toFixed(2)} {ing.unit}</TableCell>
              <TableCell>{formatCurrency(ing.ratePerUnit)} / {ing.unit}</TableCell>
              <TableCell className="text-right">{formatCurrency(ing.costContribution)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Cost summary strip */}
      <div className="mt-3 flex flex-wrap gap-6 px-1 text-sm text-muted-foreground border-t pt-3">
        <span>
          Total Cost:{" "}
          <span className="font-semibold text-foreground">{formatCurrency(totalCost)}</span>
        </span>
        <span>
          Cost / kg:{" "}
          <span className="font-semibold text-foreground">{formatCurrency(costPerKg)}</span>
        </span>
        <span>
          Base:{" "}
          <span className="font-semibold text-foreground">{baseQuantity} {baseUnit}</span>
        </span>
      </div>
    </div>
  );
};

// ─── Collapsible previous version block ──────────────────────────────────────

const PreviousVersionBlock = ({
  log,
  versionNumber,
}: {
  log: AuditLog;
  versionNumber: number;
}) => {
  const [open, setOpen] = useState(false);
  const snapshot = log.changes;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              Version {versionNumber}
            </span>
            <Badge variant="outline" className="text-xs">
              {snapshot.name}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {snapshot.baseQuantity} {snapshot.baseUnit}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Edited by{" "}
            <span className="font-medium text-foreground">
              {log.changedBy?.fullName ?? "Unknown"}
            </span>
            {" · "}
            {formatDate(log.changedAt)}
          </p>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="px-6 py-4 border-t bg-background">
          <BreakdownTable
            ingredients={snapshot.ingredients}
            baseQuantity={snapshot.baseQuantity}
            baseUnit={snapshot.baseUnit}
          />
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ViewFormulationPage() {
  const params = useParams();
  const { toast } = useToast();
  const id = params?.id as string;

  const [formulation, setFormulation] = useState<Formulation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const { isAdmin } = useAuth();

  useEffect(() => {
    const fetchFormulation = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/formulations/${id}?audit=true`);
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'Formulation not found' : 'Failed to fetch formulation');
        }
        setFormulation(await response.json());
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load formulation';
        setError(msg);
        toast({ title: "Error", description: msg, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchFormulation();
  }, [id, toast]);

  const currentCalc = useMemo(() => {
    if (!formulation) return null;
    return calculateIngredients(
      formulation.ingredients,
      formulation.baseQuantity,
      formulation.baseUnit
    );
  }, [formulation]);

  const downloadPDF = async () => {
    if (!formulation || !currentCalc) return;
    setIsDownloading(true);
    try {
      const jsPDF = (await import('jspdf')).default;
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFont('helvetica');
      const fmt = (n: number) =>
        `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

      doc.setFontSize(20);
      doc.text(formulation.name, 14, 20);
      doc.setFontSize(12);
      doc.text(`Formulation Details - ${formulation.baseQuantity} ${formulation.baseUnit}`, 14, 30);
      doc.setFontSize(10);
      doc.text(`Generated: ${formatDate(new Date().toISOString())}`, 14, 40);

      autoTable(doc, {
        head: [['Material', 'Quantity', 'Percentage']],
        body: currentCalc.rows.map((ing) => [
          ing.rawMaterialName,
          `${ing.quantity.toFixed(2)} ${ing.unit}`,
          `${ing.percentage.toFixed(2)}%`,
        ]),
        startY: 50,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [66, 66, 66], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      const finalY = (doc as any).lastAutoTable.finalY || 50;
      doc.setFontSize(10);
      doc.text(`Total Percentage: ${currentCalc.totalPercentage.toFixed(2)}%`, 14, finalY + 10);
      doc.text(`Total Cost: ${fmt(currentCalc.totalCost)}`, 14, finalY + 20);
      doc.text(`Cost per kg: ${fmt(currentCalc.costPerKg)}`, 14, finalY + 30);
      doc.save(`${formulation.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_formulation.pdf`);
      toast({ title: "Success", description: "PDF downloaded successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  // ─── Loading / Error ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading formulation...</span>
        </div>
      </AppLayout>
    );
  }

  if (error || !formulation) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-1">{error || 'Formulation not found'}</h3>
          <p className="text-muted-foreground mb-4">
            The formulation you're looking for doesn't exist or couldn't be loaded.
          </p>
          <Button asChild><Link href="/formulations">Back to Formulations</Link></Button>
        </div>
      </AppLayout>
    );
  }

  // Sort audit logs newest → oldest (these are the "before" snapshots of each edit)
  const auditLogs: AuditLog[] = [...(formulation.auditLogs ?? [])].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
  );

  // Total versions = current + all previous
  const totalVersions = auditLogs.length + 1;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout>

      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/formulations"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="page-title">{formulation.name}</h1>
            <p className="text-sm text-muted-foreground">
              Base: {formulation.baseQuantity} {formulation.baseUnit}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`status-badge ${formulation.status === 'active' ? 'status-active' : 'status-inactive'}`}>
            {formulation.status === 'active' ? 'Active' : 'Inactive'}
          </span>
          {isAdmin && (
            <Button asChild>
              <Link href={`/formulations/${formulation.id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Formulation
              </Link>
            </Button>
          )}
          <Button onClick={downloadPDF} disabled={isDownloading} variant="outline">
            {isDownloading
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <Download className="h-4 w-4 mr-2" />}
            {isDownloading ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {/* Cost Summary */}
      {currentCalc && (
        <div className="industrial-card p-6 mb-6">
          <h2 className="section-title mb-4">Cost Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-2xl font-semibold">{formatCurrency(currentCalc.totalCost)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cost per kg</p>
              <p className="text-2xl font-semibold">{formatCurrency(currentCalc.costPerKg)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Percentage</p>
              <p className="text-2xl font-semibold">{currentCalc.totalPercentage.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Raw Material Breakdown — versioned ── */}
      <div className="industrial-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-title">Raw Material Breakdown</h2>
          {auditLogs.length > 0 && (
            <Badge variant="secondary">
              {totalVersions} version{totalVersions !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {/* ── Current version (always visible, not collapsible) ── */}
        <div className="mb-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Badge className="text-xs">Current</Badge>
              <span className="text-sm font-semibold text-foreground">
                Version {totalVersions}
              </span>
            </div>
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Last Updated: {formatDate(formulation.updatedAt)}
            </span>
          </div>

          {currentCalc && currentCalc.rows.length > 0 ? (
            <BreakdownTable
              ingredients={formulation.ingredients}
              baseQuantity={formulation.baseQuantity}
              baseUnit={formulation.baseUnit}
            />
          ) : (
            <p className="text-muted-foreground text-sm">No ingredients found.</p>
          )}
        </div>

        {/* ── Previous versions (collapsible) ── */}
        {auditLogs.length > 0 && (
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-medium text-muted-foreground">Previous Versions</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {auditLogs.map((log, index) => (
              <PreviousVersionBlock
                key={log.id}
                log={log}
                // version number counts down: if total=4 and index=0 → version 3
                versionNumber={totalVersions - 1 - index}
              />
            ))}

            {/* Original created-at footer */}
            <p className="text-xs text-muted-foreground pt-2 text-center">
              Formulation originally created: {formatDate(formulation.createdAt)}
            </p>
          </div>
        )}

        {/* No history yet */}
        {auditLogs.length === 0 && (
          <p className="text-xs text-muted-foreground mt-6">
            Created: {formatDate(formulation.createdAt)}
            {formulation.updatedAt !== formulation.createdAt && (
              <> · Last Updated: {formatDate(formulation.updatedAt)}</>
            )}
          </p>
        )}
      </div>

    </AppLayout>
  );
}