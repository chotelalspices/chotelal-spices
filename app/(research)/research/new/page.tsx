'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FlaskConical,
  Calendar,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { getStoredUserName } from '@/lib/auth-utils';

import { rawMaterials } from '@/data/sampleData';
import { researchFormulations } from '@/data/researchData';
import { useIsMobile } from '@/hooks/use-mobile';

interface IngredientRow {
  id: string;
  rawMaterialId: string;
  percentage: number;
}

export default function ResearchEntry() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;

  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const isEditMode = !!id;

  const research = isEditMode
    ? researchFormulations.find((r) => r.id === id)
    : null;

  /* ================= STATE ================= */
  const [formData, setFormData] = useState({
    tempName: '',
    researcherName: user?.fullName || getStoredUserName() || '',
    researchDate: new Date().toISOString().split('T')[0],
    baseQuantity: '100',
    notes: '',
  });

  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { id: '1', rawMaterialId: '', percentage: 0 },
  ]);

  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ================= LOAD RAW MATERIALS ================= */
  useEffect(() => {
    const fetchRawMaterials = async () => {
      try {
        const response = await fetch('/api/inventory');
        if (response.ok) {
          const data = await response.json();
          setRawMaterials(data);
        }
      } catch (error) {
        console.error('Error fetching raw materials:', error);
      }
    };

    fetchRawMaterials();
  }, []);

  /* ================= UPDATE RESEARCHER NAME ================= */
  useEffect(() => {
    if (!isEditMode && (user?.fullName || getStoredUserName())) {
      setFormData(prev => ({
        ...prev,
        researcherName: user?.fullName || getStoredUserName() || ''
      }));
    }
  }, [user, isEditMode]);

  /* ================= LOAD DATA (EDIT MODE) ================= */
  useEffect(() => {
    if (research) {
      setFormData({
        tempName: research.tempName,
        researcherName: research.researcherName,
        researchDate: research.researchDate,
        baseQuantity: research.baseQuantity.toString(),
        notes: research.notes || '',
      });

      setIngredients(
        research.ingredients.map((ing, index) => ({
          id: String(index + 1),
          rawMaterialId: ing.rawMaterialId,
          percentage: ing.percentage,
        }))
      );
    }
  }, [research]);

  /* ================= INGREDIENT HELPERS ================= */
  const totalPercentage = ingredients.reduce(
    (sum, ing) => sum + ing.percentage,
    0
  );

  const addIngredient = () => {
    setIngredients((prev) => [
      ...prev,
      { id: Date.now().toString(), rawMaterialId: '', percentage: 0 },
    ]);
  };

  const removeIngredient = (id: string) => {
    if (ingredients.length <= 1) return;
    setIngredients((prev) => prev.filter((ing) => ing.id !== id));
  };

  const updateIngredient = (
    id: string,
    field: 'rawMaterialId' | 'percentage',
    value: string | number
  ) => {
    setIngredients((prev) =>
      prev.map((ing) =>
        ing.id === id ? { ...ing, [field]: value } : ing
      )
    );
  };

  const getAvailableRawMaterials = (currentId: string) => {
    const usedIds = ingredients
      .filter((ing) => ing.id !== currentId)
      .map((ing) => ing.rawMaterialId);
    return rawMaterials.filter((rm) => !usedIds.includes(rm.id));
  };

  /* ================= VALIDATION ================= */
  const canSubmit =
    formData.tempName &&
    formData.researcherName &&
    formData.researchDate &&
    formData.baseQuantity &&
    ingredients.some((ing) => ing.rawMaterialId && ing.percentage > 0) &&
    totalPercentage === 100;

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          ingredients: ingredients.filter(ing => ing.rawMaterialId && ing.percentage > 0),
          baseUnit: "kg"
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        toast({
          title: isEditMode
            ? 'Research Re-submitted'
            : 'Research Submitted',
          description: `"${formData.tempName}" has been sent for admin approval.`,
        });

        setIsSubmitting(false);
        router.push('/research');
      } else {
        throw new Error('Failed to submit research');
      }
    } catch (error) {
      console.error('Error submitting research:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit research. Please try again.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  /* ================= UI ================= */
  return (
    <AppLayout>
      <form
        onSubmit={handleSubmit}
        className="space-y-6 max-w-4xl mx-auto"
      >
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/research">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="page-title flex items-center gap-2">
                <FlaskConical className="h-6 w-6 text-primary" />
                {isEditMode
                  ? 'Edit Research Formulation'
                  : 'New Research Formulation'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isEditMode
                  ? 'Update and re-submit rejected formulation'
                  : 'Experiment with new masala formulations'}
              </p>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Temporary Masala Name *</Label>
                <Input
                  value={formData.tempName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tempName: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Researcher Name *</Label>
                <Input
                  value={formData.researcherName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      researcherName: e.target.value,
                    })
                  }
                  disabled
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Research Date *</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={formData.researchDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        researchDate: e.target.value,
                      })
                    }
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Base Quantity (kg) *</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.baseQuantity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      baseQuantity: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingredients */}
        <Card>
          <CardHeader className="flex justify-between items-center">
            <CardTitle>Raw Material Breakdown</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addIngredient}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Raw Material</TableHead>
                  <TableHead>Percentage (%)</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ing, index) => (
                  <TableRow key={ing.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <Select
                        value={ing.rawMaterialId}
                        onValueChange={(v) =>
                          updateIngredient(
                            ing.id,
                            'rawMaterialId',
                            v
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableRawMaterials(ing.id).map(
                            (rm) => (
                              <SelectItem
                                key={rm.id}
                                value={rm.id}
                              >
                                {rm.name}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={ing.percentage || ''}
                        onChange={(e) =>
                          updateIngredient(
                            ing.id,
                            'percentage',
                            Number(e.target.value)
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {ingredients.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            removeIngredient(ing.id)
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div
              className={`p-4 border-t ${
                totalPercentage === 100
                  ? 'bg-green-50'
                  : 'bg-amber-50'
              }`}
            >
              <div className="flex justify-between font-medium">
                <span>Total Percentage</span>
                <span>{totalPercentage}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Research Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={4}
              value={formData.notes}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  notes: e.target.value,
                })
              }
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href="/research">Cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isEditMode
              ? 'Re-submit for Approval'
              : 'Submit for Approval'}
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}
