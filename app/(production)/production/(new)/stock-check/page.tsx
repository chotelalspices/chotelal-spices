'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Save,
  Loader2,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  MaterialRequirement,
  hasInsufficientStock,
  allSufficientMaterialsChecked,
  hasInactiveMaterials,
  getInactiveMaterials,
  formatCurrency,
} from '@/data/productionData';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';

interface ProductionEntryData {
  formulationId: string;
  formulationName: string;
  plannedQuantity: number;
  availableQuantity: number;
  producedQuantity: number;
  numberOfLots: number;
  finalQuantity: number;
  unit: 'kg' | 'gm';
  productionDate: string;
}

export default function ProductionStockCheck() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [entryData, setEntryData] = useState<ProductionEntryData | null>(null);
  const [requirements, setRequirements] = useState<MaterialRequirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const stored = sessionStorage.getItem('productionEntry');
      if (!stored) {
        router.push('/production/new');
        return;
      }

      const data: ProductionEntryData = JSON.parse(stored);
      setEntryData(data);

      // ── Check if we're resuming a draft with saved requirements ──
      const savedRequirements = sessionStorage.getItem('materialRequirements');

      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/production/materials?formulationId=${data.formulationId}&plannedQuantity=${data.producedQuantity}`
        );

        if (!response.ok) throw new Error('Failed to fetch material requirements');

        const reqs: MaterialRequirement[] = await response.json();

        // If we have saved requirements (draft resume), merge the saved
        // rawMaterialId, actualQuantity, and isChecked back into fresh data
        if (savedRequirements) {
          const saved: MaterialRequirement[] = JSON.parse(savedRequirements);
          const merged = reqs.map((req) => {
            const match = saved.find(s => s.originalRawMaterialId === req.originalRawMaterialId);
            if (match) {
              return {
                ...req,
                rawMaterialId: match.rawMaterialId ?? req.rawMaterialId,
                rawMaterialName: match.rawMaterialName ?? req.rawMaterialName,
                actualQuantity: match.actualQuantity ?? req.actualQuantity,
                isChecked: match.isChecked ?? false,
              };
            }
            return req;
          });
          setRequirements(merged);
        } else {
          setRequirements(reqs);
        }
      } catch (error) {
        console.error('Error fetching material requirements:', error);
        toast({
          title: 'Error',
          description: 'Failed to load material requirements. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [router, toast]);

  const handleCheckChange = (index: number, checked: boolean) => {
    const updated = [...requirements];
    updated[index].isChecked = checked;
    setRequirements(updated);
  };

  const handleQuantityChange = (index: number, newQuantity: number) => {
    const updated = [...requirements];
    const req = updated[index];
    req.actualQuantity = newQuantity;
    req.stockStatus = req.availableStock >= newQuantity ? 'sufficient' : 'insufficient';
    req.cost = newQuantity * req.ratePerUnit;
    setRequirements(updated);
  };

  const handleRawMaterialChange = (index: number, newRawMaterialId: string) => {
    const updated = [...requirements];
    const req = updated[index];

    if (newRawMaterialId === req.originalRawMaterialId) {
      req.rawMaterialId = req.originalRawMaterialId!;
      req.rawMaterialName = req.originalRawMaterialName!;
      req.ratePerUnit = req.originalRatePerUnit!;
      req.availableStock = req.originalAvailableStock!;
      req.status = req.originalStatus!;
      req.stockStatus = req.originalAvailableStock! >= req.requiredQuantity ? 'sufficient' : 'insufficient';
      req.cost = req.requiredQuantity * req.originalRatePerUnit!;
    } else {
      const selectedAlternative = req.alternativeRawMaterials?.find(alt => alt.id === newRawMaterialId);
      if (selectedAlternative) {
        req.rawMaterialId = selectedAlternative.id;
        req.rawMaterialName = selectedAlternative.name;
        req.ratePerUnit = selectedAlternative.costPerUnit;
        req.availableStock = selectedAlternative.availableStock;
        req.status = selectedAlternative.status;

        let availableInSameUnit = selectedAlternative.availableStock;
        if (req.unit !== selectedAlternative.unit) {
          availableInSameUnit = req.unit === 'kg' && selectedAlternative.unit === 'gm'
            ? selectedAlternative.availableStock / 1000
            : selectedAlternative.availableStock * 1000;
        }
        req.stockStatus = availableInSameUnit >= req.requiredQuantity ? 'sufficient' : 'insufficient';

        let cost: number;
        if (req.unit === selectedAlternative.unit) {
          cost = req.requiredQuantity * selectedAlternative.costPerUnit;
        } else if (req.unit === 'kg' && selectedAlternative.unit === 'gm') {
          cost = req.requiredQuantity * 1000 * selectedAlternative.costPerUnit;
        } else {
          cost = (req.requiredQuantity / 1000) * selectedAlternative.costPerUnit;
        }
        req.cost = cost;
      }
    }

    setRequirements(updated);
  };

  const checkedCount = requirements.filter(r => r.isChecked).length;
  const hasAtLeastOneChecked = checkedCount > 0;
  const allChecked = allSufficientMaterialsChecked(requirements);
  const canProceed = allChecked && !hasInactiveMaterials(requirements);
  const canSavePartial = hasAtLeastOneChecked && !canProceed && !hasInactiveMaterials(requirements);

  const handleSaveProduction = async () => {
    if (!entryData || !hasAtLeastOneChecked) return;
    try {
      setIsSaving(true);
      const payload = {
        ...entryData,
        materialRequirements: requirements,
        status: 'draft',
        savedAt: new Date().toISOString(),
      };
      const response = await fetch('/api/production/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to save production batch');
      sessionStorage.removeItem('productionEntry');
      sessionStorage.removeItem('materialRequirements');
      toast({
        title: 'Production Saved',
        description: 'Draft batch saved successfully. You can complete it later from the production list.',
      });
      router.push('/production');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save production batch. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = () => {
    if (!canProceed) return;
    sessionStorage.setItem('materialRequirements', JSON.stringify(requirements));
    router.push('/production/confirm');
  };

  if (!entryData || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">

        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/production/new">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="page-title">Material Requirement & Stock Check</h1>
              <p className="text-muted-foreground mt-1">Step 2: Verify raw material availability</p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-medium">
              <CheckCircle className="h-4 w-4" />
            </div>
            <span className={isMobile ? 'sr-only' : 'text-sm text-muted-foreground'}>Entry</span>
          </div>
          <div className="h-px w-8 bg-primary" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              2
            </div>
            <span className={isMobile ? 'sr-only' : 'text-sm font-medium'}>Stock Check</span>
          </div>
          <div className="h-px w-8 bg-border" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
              3
            </div>
            <span className={isMobile ? 'sr-only' : 'text-sm text-muted-foreground'}>Confirm</span>
          </div>
        </div>

        {/* Summary */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Masala</p>
                <p className="font-semibold">{entryData.formulationName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Planned Production</p>
                <p className="font-semibold">
                  {entryData.plannedQuantity} {entryData.unit} × {entryData.numberOfLots} lots = {entryData.producedQuantity} {entryData.unit}
                </p>
              </div>
              {entryData.availableQuantity > 0 && (
                <div>
                  <p className="text-muted-foreground">Available Quantity</p>
                  <p className="font-semibold">{entryData.availableQuantity} {entryData.unit}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Final Total</p>
                <p className="font-semibold">{entryData.finalQuantity} {entryData.unit}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Production Date</p>
                <p className="font-semibold">
                  {new Date(entryData.productionDate).toLocaleDateString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Ingredients</p>
                <p className="font-semibold">{requirements.length} items</p>
              </div>
              {hasAtLeastOneChecked && (
                <div>
                  <p className="text-muted-foreground">Confirmed</p>
                  <p className="font-semibold">{checkedCount} / {requirements.length} materials</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        {hasInactiveMaterials(requirements) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Production Blocked - Inactive Materials</p>
              <p className="text-sm text-muted-foreground">
                The following raw materials are inactive: {getInactiveMaterials(requirements).join(', ')}. Production cannot proceed until these materials are activated.
              </p>
            </div>
          </div>
        )}

        {hasInsufficientStock(requirements) && !hasInactiveMaterials(requirements) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Low Stock Warning</p>
              <p className="text-sm text-muted-foreground">
                Some raw materials have insufficient stock. Production will proceed but may result in negative inventory quantities.
              </p>
            </div>
          </div>
        )}

        {canSavePartial && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <Save className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800">Partial Selection Detected</p>
              <p className="text-sm text-muted-foreground">
                You've confirmed {checkedCount} of {requirements.length} materials. You can save this as a draft and complete it later, or tick all remaining materials to proceed to confirmation.
              </p>
            </div>
          </div>
        )}

        {/* Requirements Table */}
        <Card>
          <CardHeader>
            <CardTitle>Raw Material Requirements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isMobile ? (
              /* ── Mobile cards ── */
              <div className="divide-y">
                {requirements.map((req, index) => (
                  <div key={`${req.originalRawMaterialId}-${index}`} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="mb-3">
                          <label className="text-xs text-muted-foreground">Raw Material:</label>
                          <Select
                            value={req.rawMaterialId}
                            onValueChange={(value) => handleRawMaterialChange(index, value)}
                            disabled={req.status === 'inactive'}
                          >
                            <SelectTrigger className="w-full mt-1">
                              <SelectValue placeholder="Select material" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={req.originalRawMaterialId!}>
                                {req.originalRawMaterialName} (Original)
                              </SelectItem>
                              {req.alternativeRawMaterials?.map((alt) => (
                                <SelectItem key={alt.id} value={alt.id}>
                                  {alt.name} ({alt.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {req.originalRawMaterialId !== req.rawMaterialId && (
                            <Badge variant="secondary" className="mt-1 text-xs">Alternative</Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Required</p>
                            <p className="font-medium">{req.requiredQuantity.toFixed(2)} {req.unit}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Actual</p>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={Number(req.actualQuantity).toFixed(2)}
                                onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                                className="w-20 h-7 text-right text-sm"
                                disabled={req.status === 'inactive'}
                              />
                              <span className="text-xs text-muted-foreground">{req.unit}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Available</p>
                            <p className="font-medium">{Number(req.availableStock).toFixed(2)} {req.unit}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Cost</p>
                            <p className="font-medium">{formatCurrency(req.cost)}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-muted-foreground">Status</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge variant={req.stockStatus === 'sufficient' ? 'default' : 'destructive'}>
                                {req.stockStatus === 'sufficient'
                                  ? <><CheckCircle className="h-3 w-3 mr-1" />Sufficient</>
                                  : <><XCircle className="h-3 w-3 mr-1" />Insufficient</>}
                              </Badge>
                              <Badge variant={req.status === 'active' ? 'default' : 'destructive'}>
                                {req.status === 'active' ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <Checkbox
                          checked={req.isChecked}
                          onCheckedChange={checked => handleCheckChange(index, checked as boolean)}
                          disabled={req.status === 'inactive'}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Desktop table — overflow hidden, no horizontal scroll ── */
              <div className="w-full overflow-hidden">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[22%]">Raw Material</TableHead>
                      <TableHead className="w-[12%] text-right">Required</TableHead>
                      <TableHead className="w-[14%] text-right">Actual Qty</TableHead>
                      <TableHead className="w-[12%] text-right">Available</TableHead>
                      <TableHead className="w-[12%] text-center">Stock</TableHead>
                      <TableHead className="w-[10%] text-center">Status</TableHead>
                      <TableHead className="w-[10%] text-right">Cost</TableHead>
                      <TableHead className="w-[8%] text-center">
                        <Checkbox
                          checked={requirements.length > 0 && requirements.filter(r => r.status !== 'inactive').every(r => r.isChecked)}
                          onCheckedChange={(checked) => {
                            setRequirements(prev =>
                              prev.map(r => r.status === 'inactive' ? r : { ...r, isChecked: !!checked })
                            );
                          }}
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requirements.map((req, index) => (
                      <TableRow key={`${req.originalRawMaterialId}-${index}`}>

                        {/* Raw Material — select with alternative options */}
                        <TableCell className="font-medium">
                          <Select
                            value={req.rawMaterialId}
                            onValueChange={(value) => handleRawMaterialChange(index, value)}
                            disabled={req.status === 'inactive'}
                          >
                            <SelectTrigger className="w-full text-xs">
                              <SelectValue placeholder="Select material" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={req.originalRawMaterialId!}>
                                {req.originalRawMaterialName} (Original)
                              </SelectItem>
                              {req.alternativeRawMaterials?.map((alt) => (
                                <SelectItem key={alt.id} value={alt.id}>
                                  {alt.name} ({alt.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {req.originalRawMaterialId !== req.rawMaterialId && (
                            <Badge variant="secondary" className="mt-1 text-xs">Alt</Badge>
                          )}
                        </TableCell>

                        {/* Required */}
                        <TableCell className="text-right text-sm">
                          {req.requiredQuantity.toFixed(2)}<br />
                          <span className="text-xs text-muted-foreground">{req.unit}</span>
                        </TableCell>

                        {/* Actual Qty — capped to 2 decimal places */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={Number(req.actualQuantity).toFixed(2)}
                              onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value) || 0)}
                              className="w-20 h-8 text-right text-sm"
                              disabled={req.status === 'inactive'}
                            />
                            <span className="text-xs text-muted-foreground">{req.unit}</span>
                          </div>
                        </TableCell>

                        {/* Available */}
                        <TableCell className="text-right text-sm">
                          {Number(req.availableStock).toFixed(2)}<br />
                          <span className="text-xs text-muted-foreground">{req.unit}</span>
                        </TableCell>

                        {/* Stock Status */}
                        <TableCell className="text-center">
                          <Badge variant={req.stockStatus === 'sufficient' ? 'default' : 'destructive'} className="text-xs">
                            {req.stockStatus === 'sufficient'
                              ? <><CheckCircle className="h-3 w-3 mr-1" />OK</>
                              : <><XCircle className="h-3 w-3 mr-1" />Low</>}
                          </Badge>
                        </TableCell>

                        {/* Material Status */}
                        <TableCell className="text-center">
                          <Badge variant={req.status === 'active' ? 'default' : 'destructive'} className="text-xs">
                            {req.status === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>

                        {/* Cost */}
                        <TableCell className="text-right text-sm">
                          {formatCurrency(req.cost)}
                        </TableCell>

                        {/* Confirm checkbox */}
                        <TableCell className="text-center">
                          <Checkbox
                            checked={req.isChecked}
                            onCheckedChange={checked => handleCheckChange(index, checked as boolean)}
                            disabled={req.status === 'inactive'}
                          />
                        </TableCell>

                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <div className="bg-muted/50 rounded-lg p-4 text-sm">
          <p className="text-muted-foreground">
            <strong>Instructions:</strong>
            <br />• Tick the checkbox next to each material to confirm usage.
            <br />• You can select alternative raw materials from the dropdown if needed.
            <br />• Alternative materials will be deducted instead of the original formulation materials.
            <br />• Production will be blocked if any selected raw material is inactive.
            <br />• Production will proceed regardless of stock levels for active materials.
            <br />• If you can't complete all confirmations now, use <strong>Save as Draft</strong> to continue later.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-3">
          <Button variant="outline" asChild>
            <Link href="/production/new">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>

          <div className="flex items-center gap-3">
            {canSavePartial && (
              <Button
                variant="outline"
                onClick={handleSaveProduction}
                disabled={isSaving}
                className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                {isSaving
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Save className="h-4 w-4" />}
                Save as Draft
              </Button>
            )}
            <Button onClick={handleNext} disabled={!canProceed} className="gap-2">
              Proceed to Confirmation
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}