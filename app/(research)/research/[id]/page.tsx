'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, FlaskConical, CheckCircle, XCircle, Clock,
  User, Calendar, FileText, Package2,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { formatDate } from '@/data/sampleData';
import { useIsMobile } from '@/hooks/use-mobile';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtendedItemView {
  id: string;
  extendedInventoryId: string;
  productName: string;
  code: string | null;
  price: number;
  companyName: string | null;
  quantity: number;
  percentage: number;
  notes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    default:         return 'bg-muted text-muted-foreground';
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'pending':  return 'Pending Review';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    default:         return status;
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ResearchApproval() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;

  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || false;

  const [research, setResearch] = useState<any>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingFormulation, setExistingFormulation] = useState<any>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const isActioning = showApproveDialog || showRejectDialog;

  // ─── Fetch ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchResearch = async () => {
      if (!id) { router.push('/research'); return; }
      try {
        const response = await fetch(`/api/research/${id}`);
        if (response.ok) {
          setResearch(await response.json());
        } else {
          throw new Error('Failed to fetch research formulation');
        }
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to load research formulation', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchResearch();
  }, [id, router, toast]);

  const checkForExistingFormulation = async (name: string) => {
    setCheckingDuplicates(true);
    try {
      const res = await fetch(`/api/formulations/check-duplicate?name=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        setExistingFormulation(data.exists ? data.formulation : null);
      }
    } catch { /* silent */ } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleApproveDialogOpen = () => {
    if (research?.tempName) checkForExistingFormulation(research.tempName);
    setShowApproveDialog(true);
  };

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/research/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (res.ok) {
        toast({
          title: 'Formulation Approved',
          description: existingFormulation
            ? `"${research.tempName}" approved and replaced the existing formulation.`
            : `"${research.tempName}" approved and added to formulations.`,
        });
        router.push('/research');
      } else {
        throw new Error('Failed to approve');
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to approve formulation', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
      setShowApproveDialog(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/research/${id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejectionReason }),
      });
      if (res.ok) {
        toast({
          title: 'Formulation Rejected',
          description: `"${research.tempName}" has been rejected with feedback.`,
          variant: 'destructive',
        });
        router.push('/research');
      } else {
        throw new Error('Failed to reject');
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to reject formulation', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
      setShowRejectDialog(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-pulse" />
          <h3 className="text-lg font-medium">Loading research formulation...</h3>
        </div>
      </AppLayout>
    );
  }

  if (!research) {
    return (
      <AppLayout>
        <div className="page-header">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/research"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">Research formulation not found</h3>
        </div>
      </AppLayout>
    );
  }

  const extendedItems: ExtendedItemView[] = research.extendedItems ?? [];
  const extendedTotalQty = extendedItems.reduce((s, i) => s + (i.quantity || 0), 0);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">

        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/research"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div className="flex-1">
              <h1 className="page-title flex items-center gap-2">
                <FlaskConical className="h-6 w-6 text-primary" />
                {research.tempName}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusColor(research.status)}>
                  {research.status === 'pending' && <Clock className="h-3.5 w-3.5 mr-1" />}
                  {research.status === 'approved' && <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                  {research.status === 'rejected' && <XCircle className="h-3.5 w-3.5 mr-1" />}
                  {getStatusLabel(research.status)}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle>Research Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Researcher</p>
                  <p className="font-medium">{research.researcher}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Research Date</p>
                  <p className="font-medium">{formatDate(research.researchDate)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FlaskConical className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Base Quantity</p>
                  <p className="font-medium">{research.baseQuantity} {research.baseUnit}</p>
                </div>
              </div>
              {research.reviewedBy && (
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Reviewed By</p>
                    <p className="font-medium">{research.reviewedBy.fullName}</p>
                    {research.reviewedAt && (
                      <p className="text-xs text-muted-foreground">{formatDate(research.reviewedAt)}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ingredients */}
        <Card>
          <CardHeader><CardTitle>Ingredient Breakdown</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isMobile ? (
              <div className="divide-y">
                {research.ingredients.map((ing: any, index: number) => (
                  <div key={ing.rawMaterialId} className="p-4 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{ing?.rawMaterial?.name}</p>
                      <p className="text-sm text-muted-foreground">Ingredient {index + 1}</p>
                    </div>
                    <p className="text-lg font-bold">{ing.percentage.toFixed(2)}%</p>
                  </div>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Raw Material</TableHead>
                    <TableHead className="text-right">Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {research.ingredients.map((ing: any, index: number) => (
                    <TableRow key={ing.rawMaterialId}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{ing?.rawMaterial?.name}</TableCell>
                      <TableCell className="text-right">{ing.percentage.toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/40">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">
                      {research.ingredients
                        .reduce((sum: number, ing: any) => sum + ing.percentage, 0)
                        .toFixed(2)}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Extended Inventory Items */}
        {extendedItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package2 className="h-5 w-5 text-primary" />
                Extended Inventory Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isMobile ? (
                <div className="divide-y">
                  {extendedItems.map((item, index) => (
                    <div key={item.id} className="p-4">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                            {item.code && <span className="font-mono">{item.code}</span>}
                            {isAdmin && item.companyName && <span>{item.companyName}</span>}
                          </div>
                        </div>
                        <p className="text-lg font-bold">{item.percentage.toFixed(1)}%</p>
                      </div>
                      <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                        <span>{item.quantity.toFixed(3)} kg</span>
                        {item.price > 0 && <span>{fmt(item.price)}</span>}
                        {item.notes && <span className="italic">{item.notes}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Item</TableHead>
                      {isAdmin && <TableHead>Company</TableHead>}
                      <TableHead>Code</TableHead>
                      <TableHead className="text-right">Qty (kg)</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extendedItems.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-muted-foreground text-sm">
                            {item.companyName ?? '—'}
                          </TableCell>
                        )}
                        <TableCell>
                          {item.code
                            ? <span className="font-mono text-xs">{item.code}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity.toFixed(3)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {item.percentage.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {item.price > 0 ? fmt(item.price) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.notes ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals row */}
                    <TableRow className="font-semibold bg-muted/40 border-t-2">
                      <TableCell />
                      <TableCell className="text-muted-foreground text-sm">Total</TableCell>
                      {isAdmin && <TableCell />}
                      <TableCell />
                      <TableCell className="text-right">{extendedTotalQty.toFixed(3)} kg</TableCell>
                      <TableCell className="text-right">100%</TableCell>
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {research.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Research Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{research.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Rejection Reason */}
        {research.status === 'rejected' && research.rejectionReason && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Rejection Reason
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{research.rejectionReason}</p>
            </CardContent>
          </Card>
        )}

        {/* Admin Actions */}
        {isAdmin && research.status === 'pending' && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader><CardTitle>Admin Review</CardTitle></CardHeader>
            <CardContent className="flex gap-3">
              <Button
                onClick={handleApproveDialogOpen}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={isActioning}
              >
                <CheckCircle className="h-4 w-4 mr-2" />Approve
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
                className="flex-1"
                disabled={isActioning}
              >
                <XCircle className="h-4 w-4 mr-2" />Reject
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Approve Dialog */}
        <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Approve Formulation?</AlertDialogTitle>
              <AlertDialogDescription>
                {checkingDuplicates ? (
                  'Checking for existing formulations...'
                ) : existingFormulation ? (
                  <span className="text-amber-600 font-medium">
                    ⚠️ A formulation named "{research.tempName}" already exists and will be replaced.
                  </span>
                ) : (
                  <>This will add "{research.tempName}" to the main formulation list and make it available for production.</>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleApprove}
                disabled={isSubmitting || checkingDuplicates}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? 'Approving...' : existingFormulation ? 'Replace & Approve' : 'Approve'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reject Dialog */}
        <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject Formulation?</AlertDialogTitle>
              <AlertDialogDescription>
                Please provide a reason for rejection. This will be visible to the researcher.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="reason">Rejection Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Explain why this formulation is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="mt-2"
                rows={4}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReject}
                disabled={isSubmitting || !rejectionReason.trim()}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isSubmitting ? 'Rejecting...' : 'Reject'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </AppLayout>
  );
}