'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  FlaskConical, 
  CheckCircle, 
  XCircle, 
  Clock,
  User,
  Calendar,
  FileText
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { formatDate } from '@/data/sampleData';
import { useIsMobile } from '@/hooks/use-mobile';

export default function ResearchApproval() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;

  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [research, setResearch] = useState<any>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAcceptingOrRejecting, setIsAcceptingOrRejecting] = useState(false);
  const [existingFormulation, setExistingFormulation] = useState<any>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('admin') || false;

  useEffect(() => {
    if (showApproveDialog || showRejectDialog) {
      setIsAcceptingOrRejecting(true);
    } else {
      setIsAcceptingOrRejecting(false);
    }
  }, [showApproveDialog, showRejectDialog])

  useEffect(() => {
    const fetchResearch = async () => {
      if (!id) {
        router.push('/research');
        return;
      }

      try {
        const response = await fetch(`/api/research/${id}`);
        if (response.ok) {
          const data = await response.json();
          setResearch(data);
        } else {
          throw new Error('Failed to fetch research formulation');
        }
      } catch (error) {
        console.error('Error fetching research:', error);
        toast({
          title: 'Error',
          description: 'Failed to load research formulation',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchResearch();
  }, [id, router]);

  const checkForExistingFormulation = async (formulationName: string) => {
    setCheckingDuplicates(true);
    try {
      const response = await fetch(`/api/formulations/check-duplicate?name=${encodeURIComponent(formulationName)}`);
      if (response.ok) {
        const data = await response.json();
        setExistingFormulation(data.exists ? data.formulation : null);
      }
    } catch (error) {
      console.error('Error checking for duplicates:', error);
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleApproveDialogOpen = () => {
    if (research?.tempName) {
      checkForExistingFormulation(research.tempName);
    }
    setShowApproveDialog(true);
  };

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

  if (!research) return (
    <AppLayout>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/research">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-pulse" />
        <h3 className="text-lg font-medium">Research formulation not found</h3>
      </div>
    </AppLayout>
  );

  const handleApprove = async () => {
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/research/${id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (response.ok) {
        toast({
          title: 'Formulation Approved',
          description: existingFormulation 
            ? `"${research.tempName}" has been approved and replaced the existing formulation.`
            : `"${research.tempName}" has been approved and added to main formulation list.`,
        });

        setIsSubmitting(false);
        setShowApproveDialog(false);
        router.push('/research');
      } else {
        throw new Error('Failed to approve formulation');
      }
    } catch (error) {
      console.error('Error approving research:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve formulation',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;

    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/research/${id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'reject',
          rejectionReason 
        }),
      });

      if (response.ok) {
        toast({
          title: 'Formulation Rejected',
          description: `"${research.tempName}" has been rejected with feedback.`,
          variant: 'destructive',
        });

        setIsSubmitting(false);
        setShowRejectDialog(false);
        router.push('/research');
      } else {
        throw new Error('Failed to reject formulation');
      }
    } catch (error) {
      console.error('Error rejecting research:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject formulation',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = () => {
    switch (research.status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-black dark:bg-amber-900/30 dark:text-black';
      case 'approved':
        return 'bg-green-100 text-black dark:bg-green-900/30 dark:text-black';
      case 'rejected':
        return 'bg-red-100 text-black dark:bg-red-900/30 dark:text-black';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/research">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex-1">
              <h1 className="page-title flex items-center gap-2">
                <FlaskConical className="h-6 w-6 text-primary" />
                {research.tempName}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusColor(research.status)}>
                  {getStatusIcon()}
                  <span className="ml-1">
                    {getStatusLabel(research.status)}
                  </span>
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Research Details</CardTitle>
          </CardHeader>
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
                  <p className="font-medium">
                    {formatDate(research.researchDate)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FlaskConical className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Base Quantity</p>
                  <p className="font-medium">
                    {research.baseQuantity} {research.baseUnit}
                  </p>
                </div>
              </div>

              {research.reviewedBy && (
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Reviewed By</p>
                    <p className="font-medium">{research.reviewedBy.fullName}</p>
                    {research.reviewedAt && (
                      <p className="text-xs text-muted-foreground">
                        {formatDate(research.reviewedAt)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ingredients */}
        <Card>
          <CardHeader>
            <CardTitle>Ingredient Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isMobile ? (
              <div className="divide-y">
                {research.ingredients.map((ing:any, index:any) => (
                  <div
                    key={ing.rawMaterialId}
                    className="p-4 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium">
                        {ing?.rawMaterial?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Ingredient {index + 1}
                      </p>
                    </div>
                    <p className="text-lg font-bold">
                      {ing.percentage}%
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Raw Material</TableHead>
                    <TableHead className="text-right">
                      Percentage
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {research.ingredients.map((ing:any, index:any) => (
                    <TableRow key={ing.rawMaterialId}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {ing?.rawMaterial?.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {ing.percentage}%
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">
                      {research.ingredients.reduce(
                        (sum:any, ing:any) => sum + ing.percentage,
                        0
                      )}
                      %
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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
              <p className="text-muted-foreground whitespace-pre-wrap">
                {research.notes}
              </p>
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
              <p className="text-muted-foreground">
                {research.rejectionReason}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Admin Actions */}
        {isAdmin && research.status === 'pending' && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle>Admin Review</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button
                onClick={handleApproveDialogOpen}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={isAcceptingOrRejecting}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowRejectDialog(true)}
                className="flex-1"
                disabled={isAcceptingOrRejecting}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Approve Dialog */}
        <AlertDialog
          open={showApproveDialog}
          onOpenChange={setShowApproveDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Approve Formulation?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {checkingDuplicates ? (
                  'Checking for existing formulations...'
                ) : existingFormulation ? (
                  <div className="space-y-2">
                    <p className="text-amber-600 font-medium">
                      ⚠️ A formulation with the name "{research.tempName}" already exists.
                    </p>
                    <p>
                      The existing formulation will be replaced with this new version including updated ingredients and specifications.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p>This will add "{research.tempName}" to the main formulation list</p>
                    <p>and make it available for production.</p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>
                Cancel
              </AlertDialogCancel>
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
        <AlertDialog
          open={showRejectDialog}
          onOpenChange={setShowRejectDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Reject Formulation?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Please provide a reason for rejection. This feedback will be
                visible to the researcher.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="reason">Rejection Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Explain why this formulation is being rejected..."
                value={rejectionReason}
                onChange={(e) =>
                  setRejectionReason(e.target.value)
                }
                className="mt-2"
                rows={4}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>
                Cancel
              </AlertDialogCancel>
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
