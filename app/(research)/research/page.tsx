"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FlaskConical,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/data/sampleData';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/use-auth';

export default function ResearchList() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [researchFormulations, setResearchFormulations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [checkingDuplicates, setCheckingDuplicates] = useState<string | null>(null);
  const [duplicateFormulations, setDuplicateFormulations] = useState<Record<string, any>>({});

  const isAdmin = user?.roles?.includes('admin') || false;

  /* ================= FETCH DATA ================= */
  useEffect(() => {
    const fetchResearchFormulations = async () => {
      try {
        const response = await fetch('/api/research');
        if (response.ok) {
          const data = await response.json();
          setResearchFormulations(data);
        } else {
          throw new Error('Failed to fetch research formulations');
        }
      } catch (error) {
        console.error('Error fetching research formulations:', error);
        toast({
          title: 'Error',
          description: 'Failed to load research formulations',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchResearchFormulations();
  }, []);

  const filteredFormulations = researchFormulations.filter((research) => {
    const matchesSearch =
      research.tempName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      research.researcher.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || research.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Stats
  const pendingCount = researchFormulations.filter(
    (r) => r.status === 'pending'
  ).length;
  const approvedCount = researchFormulations.filter(
    (r) => r.status === 'approved'
  ).length;
  const rejectedCount = researchFormulations.filter(
    (r) => r.status === 'rejected'
  ).length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-3 w-3 mr-1" />;
      case 'approved':
        return <CheckCircle className="h-3 w-3 mr-1" />;
      case 'rejected':
        return <XCircle className="h-3 w-3 mr-1" />;
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

  const checkForExistingFormulation = async (formulationName: string, researchId: string) => {
    setCheckingDuplicates(researchId);
    try {
      const response = await fetch(`/api/formulations/check-duplicate?name=${encodeURIComponent(formulationName)}`);
      if (response.ok) {
        const data = await response.json();
        setDuplicateFormulations(prev => ({
          ...prev,
          [researchId]: data.exists ? data.formulation : null
        }));
      }
    } catch (error) {
      console.error('Error checking for duplicates:', error);
    } finally {
      setCheckingDuplicates(null);
    }
  };

  const handleQuickApprove = async (id: string, tempName: string) => {
    try {
      const response = await fetch(`/api/research/${id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (response.ok) {
        const isDuplicate = duplicateFormulations[id];
        toast({
          title: 'Formulation Approved',
          description: isDuplicate 
            ? `"${tempName}" has been approved and replaced the existing formulation.`
            : `"${tempName}" has been approved and added to main formulation list.`,
        });
        
        // Refresh the list
        const updatedResponse = await fetch('/api/research');
        if (updatedResponse.ok) {
          const data = await updatedResponse.json();
          setResearchFormulations(data);
        }
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
    }
  };

  const handleQuickReject = async (id: string, tempName: string) => {
    const reason = prompt(`Please provide rejection reason for "${tempName}":`);
    if (!reason || !reason.trim()) return;

    try {
      const response = await fetch(`/api/research/${id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'reject',
          rejectionReason: reason.trim() 
        }),
      });

      if (response.ok) {
        toast({
          title: 'Formulation Rejected',
          description: `"${tempName}" has been rejected with feedback.`,
          variant: 'destructive',
        });
        
        // Refresh the list
        const updatedResponse = await fetch('/api/research');
        if (updatedResponse.ok) {
          const data = await updatedResponse.json();
          setResearchFormulations(data);
        }
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
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <FlaskConical className="h-7 w-7 text-primary" />
              Formulation Research
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin 
                ? 'All experimental formulations awaiting approval' 
                : 'Your experimental formulations awaiting approval'
              }
            </p>
          </div>
          <Button
            onClick={() => router.push('/research/new')}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Research
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
              <p className="text-2xl font-bold mt-1">{pendingCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
              <p className="text-2xl font-bold mt-1">{approvedCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
              <p className="text-2xl font-bold mt-1">{rejectedCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or researcher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* LIST */}
        {loading ? (
          <div className="text-center py-12">
            <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-pulse" />
            <h3 className="text-lg font-medium">Loading research formulations...</h3>
          </div>
        ) : isMobile ? (
          <div className="space-y-3">
            {filteredFormulations.map((research) => (
              <Card key={research.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold">{research.tempName}</p>
                      <p className="text-sm text-muted-foreground">
                        {research.researcher}
                      </p>
                    </div>
                    <Badge className={getStatusColor(research.status)}>
                      {getStatusIcon(research.status)}
                      {getStatusLabel(research.status)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <p className="text-muted-foreground">Date</p>
                      <p className="font-medium">
                        {formatDate(research.researchDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Base Qty</p>
                      <p className="font-medium">
                        {research.baseQuantity} {research.baseUnit}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(`/research/${research.id}`)
                      }
                    >
                      View
                    </Button>

                    {isAdmin && research.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!duplicateFormulations[research.id] && checkingDuplicates !== research.id) {
                              checkForExistingFormulation(research.tempName, research.id);
                            }
                            handleQuickApprove(research.id, research.tempName);
                          }}
                          className="bg-green-600 hover:bg-green-700"
                          disabled={checkingDuplicates === research.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {checkingDuplicates === research.id 
                            ? 'Checking...' 
                            : duplicateFormulations[research.id] 
                              ? 'Replace & Approve' 
                              : 'Approve'
                          }
                        </Button>
                        {duplicateFormulations[research.id] && (
                          <p className="text-xs text-amber-600 mt-1">
                            Will replace existing formulation
                          </p>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleQuickReject(research.id, research.tempName)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </>
                    )}

                    {research.status === 'rejected' && (
                      <Button
                        size="sm"
                        onClick={() =>
                          router.push(`/research/${research.id}/edit`)
                        }
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit & Resubmit
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Formulation Name</TableHead>
                  <TableHead>Researcher</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Base Qty</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Reviewed By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFormulations.map((research) => (
                  <TableRow key={research.id}>
                    <TableCell className="font-medium">
                      {research.tempName}
                    </TableCell>
                    <TableCell>{research.researcher}</TableCell>
                    <TableCell>
                      {formatDate(research.researchDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      {research.baseQuantity} {research.baseUnit}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getStatusColor(research.status)}>
                        {getStatusIcon(research.status)}
                        {getStatusLabel(research.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {research.reviewedBy?.fullName || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/research/${research.id}`)
                          }
                        >
                          View
                        </Button>

                        {isAdmin && research.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                if (!duplicateFormulations[research.id] && checkingDuplicates !== research.id) {
                                  checkForExistingFormulation(research.tempName, research.id);
                                }
                                handleQuickApprove(research.id, research.tempName);
                              }}
                              className="bg-green-600 hover:bg-green-700"
                              disabled={checkingDuplicates === research.id}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              {checkingDuplicates === research.id 
                                ? 'Checking...' 
                                : duplicateFormulations[research.id] 
                                  ? 'Replace & Approve' 
                                  : 'Approve'
                              }
                            </Button>
                            {duplicateFormulations[research.id] && (
                              <div className="text-xs text-amber-600 mt-1 whitespace-nowrap">
                                Will replace existing
                              </div>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleQuickReject(research.id, research.tempName)}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}

                        {research.status === 'rejected' && (
                          <Button
                            size="sm"
                            onClick={() =>
                              router.push(`/research/${research.id}/edit`)
                            }
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {!loading && filteredFormulations.length === 0 && (
          <div className="text-center py-12">
            <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">
              No research formulations found
            </h3>
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : isAdmin 
                  ? 'No research formulations have been created yet'
                  : 'Start by creating a new research formulation'
              }
            </p>
          </div>
        )}

        {isMobile && (
          <Button
            onClick={() => router.push('/research/new')}
            className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
            size="icon"
          >
            <Plus className="h-6 w-6" />
          </Button>
        )}
      </div>
    </AppLayout>
  );
}
