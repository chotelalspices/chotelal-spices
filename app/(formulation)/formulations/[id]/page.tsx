'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Loader2, AlertCircle, Download } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate } from '@/data/sampleData';
import { useToast } from '@/hooks/use-toast';

// Note: You'll need to install these packages:
// npm install jspdf jspdf-autotable
// import jsPDF from 'jspdf';
// import 'jspdf-autotable';

declare global {
  interface Window {
    jsPDF: any;
  }
}

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
}

interface CalculatedIngredient {
  rawMaterialId: string;
  rawMaterialName: string;
  percentage: number;
  quantity: number;
  unit: 'kg' | 'gm';
  ratePerUnit: number;
  costContribution: number;
}

export default function ViewFormulationPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params?.id as string;

  const [formulation, setFormulation] = useState<Formulation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const fetchFormulation = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/formulations/${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Formulation not found');
          }
          throw new Error('Failed to fetch formulation');
        }

        const data = await response.json();
        setFormulation(data);
      } catch (error) {
        console.error('Error fetching formulation:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load formulation';
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

    if (id) {
      fetchFormulation();
    }
  }, [id, toast]);

  const calculations = useMemo(() => {
    if (!formulation) return null;

    const calculatedIngredients: CalculatedIngredient[] = [];
    let totalCost = 0;
    let totalPercentage = 0;

    formulation.ingredients.forEach((ingredient) => {
      totalPercentage += ingredient.percentage;

      // Calculate quantity based on percentage
      const quantity = (ingredient.percentage / 100) * formulation.baseQuantity;

      // Calculate cost contribution
      let costContribution: number;
      if (formulation.baseUnit === ingredient.rawMaterialUnit) {
        costContribution = quantity * ingredient.rawMaterialCostPerUnit;
      } else if (formulation.baseUnit === 'kg' && ingredient.rawMaterialUnit === 'gm') {
        // Base is kg, material is priced per gm
        costContribution = (quantity * 1000) * ingredient.rawMaterialCostPerUnit;
      } else {
        // Base is gm, material is priced per kg
        costContribution = (quantity / 1000) * ingredient.rawMaterialCostPerUnit;
      }

      totalCost += costContribution;

      calculatedIngredients.push({
        rawMaterialId: ingredient.rawMaterialId,
        rawMaterialName: ingredient.rawMaterialName,
        percentage: ingredient.percentage,
        quantity,
        unit: formulation.baseUnit,
        ratePerUnit: ingredient.rawMaterialCostPerUnit,
        costContribution,
      });
    });

    // Calculate cost per kg
    const baseInKg = formulation.baseUnit === 'kg' ? formulation.baseQuantity : formulation.baseQuantity / 1000;
    const costPerKg = baseInKg > 0 ? totalCost / baseInKg : 0;

    return { calculatedIngredients, totalCost, costPerKg, totalPercentage };
  }, [formulation]);

  const downloadPDF = async () => {
    if (!formulation || !calculations) return;

    setIsDownloading(true);
    try {
      // Dynamically import jsPDF to avoid SSR issues
      const jsPDF = (await import('jspdf')).default;
      const { default: autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF();
      
      // Set font to support better character encoding
      doc.setFont('helvetica');
      
      // Custom currency formatter for PDF
      const formatCurrencyForPDF = (amount: number): string => {
        // Use Rs. instead of ₹ symbol for better PDF compatibility
        return `Rs. ${amount.toLocaleString('en-IN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}`;
      };
      
      // Add title
      doc.setFontSize(20);
      doc.text(formulation.name, 14, 20);
      
      // Add subtitle
      doc.setFontSize(12);
      doc.text(`Formulation Details - ${formulation.baseQuantity} ${formulation.baseUnit}`, 14, 30);
      
      // Add date
      doc.setFontSize(10);
      doc.text(`Generated: ${formatDate(new Date().toISOString())}`, 14, 40);
      
      // Prepare table data
      const tableData = calculations.calculatedIngredients.map((ing) => [
        ing.rawMaterialName,
        `${ing.quantity.toFixed(2)} ${ing.unit}`,
        `${ing.percentage.toFixed(2)}%`
      ]);
      
      // Add table
      autoTable(doc, {
        head: [['Product Name', 'Quantity', 'Percentage']],
        body: tableData,
        startY: 50,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [66, 66, 66],
          textColor: 255,
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
      });
      
      // Add summary at the bottom
      const finalY = (doc as any).lastAutoTable.finalY || 50;
      doc.setFontSize(10);
      doc.setFont('helvetica');
      doc.text(`Total Percentage: ${calculations.totalPercentage.toFixed(2)}%`, 14, finalY + 10);
      doc.text(`Total Cost: ${formatCurrencyForPDF(calculations.totalCost)}`, 14, finalY + 20);
      doc.text(`Cost per kg: ${formatCurrencyForPDF(calculations.costPerKg)}`, 14, finalY + 30);
      
      // Save the PDF
      doc.save(`${formulation.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_formulation.pdf`);
      
      toast({
        title: "Success",
        description: "Formulation PDF downloaded successfully",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please ensure jspdf and jspdf-autotable are installed.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

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
          <h3 className="text-lg font-medium text-foreground mb-1">
            {error || 'Formulation not found'}
          </h3>
          <p className="text-muted-foreground mb-4">
            The formulation you're looking for doesn't exist or couldn't be loaded.
          </p>
          <Button asChild>
            <Link href="/formulations">Back to Formulations</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/formulations">
              <ArrowLeft className="h-5 w-5" />
            </Link>
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
          <Button asChild>
            <Link href={`/formulations/${formulation.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Formulation
            </Link>
          </Button>
          <Button 
            onClick={downloadPDF}
            disabled={isDownloading}
            variant="outline"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {isDownloading ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {/* Cost Summary */}
      {calculations && (
        <div className="industrial-card p-6 mb-6">
          <h2 className="section-title mb-4">Cost Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(calculations.totalCost)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cost per kg</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(calculations.costPerKg)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Percentage</p>
              <p className="text-2xl font-semibold text-foreground">
                {calculations.totalPercentage.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ingredients Table */}
      <div className="industrial-card p-6">
        <h2 className="section-title mb-4">Raw Material Breakdown</h2>
        {calculations && calculations.calculatedIngredients.length > 0 ? (
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
              {calculations.calculatedIngredients.map((ing) => (
                <TableRow key={ing.rawMaterialId}>
                  <TableCell className="font-medium">{ing.rawMaterialName}</TableCell>
                  <TableCell>{ing.percentage.toFixed(2)}%</TableCell>
                  <TableCell>
                    {ing.quantity.toFixed(2)} {ing.unit}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(ing.ratePerUnit)} / {ing.unit}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(ing.costContribution)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground">No ingredients found.</p>
        )}
      </div>

      {/* Metadata */}
      <div className="mt-6 text-sm text-muted-foreground">
        <p>Created: {formatDate(formulation.createdAt)}</p>
        <p>Last Updated: {formatDate(formulation.updatedAt)}</p>
      </div>
    </AppLayout>
  );
}
