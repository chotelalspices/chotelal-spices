'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Plus, Search, Loader2, AlertCircle } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { FormulationCard } from '@/components/formulation/FormulationCard';
import { FormulationTable } from '@/components/formulation/FormulationTable';
import { Formulation } from '@/data/formulationData';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

export default function FormulationListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [formulations, setFormulations] = useState<Formulation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  /* ================= FETCH FORMULATIONS ================= */
  useEffect(() => {
    const fetchFormulations = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch('/api/formulations');
        
        if (!response.ok) {
          throw new Error('Failed to fetch formulations');
        }

        const data = await response.json();
        setFormulations(data);
      } catch (error) {
        console.error('Error fetching formulations:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load formulations';
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

    fetchFormulations();
  }, [toast]);

  const filteredFormulations = useMemo(() => {
    return formulations.filter((formulation) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!formulation.name.toLowerCase().includes(query)) {
          return false;
        }
      }

      if (statusFilter !== 'all' && formulation.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [formulations, searchQuery, statusFilter]);

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Formulations</h1>
          <p className="text-muted-foreground text-sm mt-1 hidden md:block">
            Manage masala recipes and formulations
          </p>
        </div>

        {isAdmin && (
          <Button asChild className="hidden md:flex">
            <Link href="/formulations/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Formulation
            </Link>
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search formulations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading formulations...</span>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            Error loading formulations
          </h3>
          <p className="text-muted-foreground mb-4">
            {error}
          </p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}

      {/* Results count */}
      {!isLoading && !error && (
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Showing {filteredFormulations.length} of {formulations.length} formulations
          </p>
        </div>
      )}

      {/* Desktop Table */}
      {!isLoading && !error && (
        <div className="hidden md:block">
          <FormulationTable formulations={filteredFormulations} isAdmin={isAdmin} />
        </div>
      )}

      {/* Mobile Cards */}
      {!isLoading && !error && (
        <div className="md:hidden space-y-3">
          {filteredFormulations.map((formulation) => (
            <FormulationCard key={formulation.id} formulation={formulation} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredFormulations.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            No formulations found
          </h3>
          <p className="text-muted-foreground">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first masala formulation to get started'}
          </p>
        </div>
      )}

      {/* Mobile FAB */}
      {isAdmin && (
        <Link
          href="/formulations/new"
          className="md:hidden fixed right-4 bottom-20 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors z-40"
        >
          <Plus className="h-6 w-6" />
        </Link>
      )}
    </AppLayout>
  );
}
