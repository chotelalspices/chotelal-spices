'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/libs/utils';
import { ArrowLeft, ArrowRight, Factory, Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Formulation } from '@/data/formulationData';

export default function ProductionEntry() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [activeFormulations, setActiveFormulations] = useState<Formulation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormulationOpen, setIsFormulationOpen] = useState(false);

  useEffect(() => {
    const fetchFormulations = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/formulations');

        if (!response.ok) {
          throw new Error('Failed to fetch formulations');
        }

        const data = await response.json();
        // Filter for active formulations
        setActiveFormulations(data.filter((f: Formulation) => f.status === 'active'));
      } catch (error) {
        console.error('Error fetching formulations:', error);
        toast({
          title: 'Error',
          description: 'Failed to load formulations. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchFormulations();
  }, [toast]);

  const [formData, setFormData] = useState({
    formulationId: '',
    plannedQuantity: '',
    availableQuantity: '',
    numberOfLots: '1',
    productionDate: new Date().toISOString().split('T')[0],
  });

  const selectedFormulation = activeFormulations.find(
    f => f.id === formData.formulationId
  );

  const grossQuantity = formData.plannedQuantity && formData.numberOfLots
    ? Number(formData.plannedQuantity) * Number(formData.numberOfLots) + (Number(formData.availableQuantity) || 0)
    : 0;

  const canProceed =
    formData.formulationId &&
    formData.plannedQuantity &&
    Number(formData.plannedQuantity) > 0 &&
    formData.numberOfLots &&
    Number(formData.numberOfLots) > 0 &&
    formData.productionDate;

  const handleNext = () => {
    if (!canProceed) return;

    const producedQty = Number(formData.plannedQuantity) * Number(formData.numberOfLots);
    const availableQty = Number(formData.availableQuantity) || 0;

    sessionStorage.setItem(
      'productionEntry',
      JSON.stringify({
        formulationId: formData.formulationId,
        formulationName: selectedFormulation?.name,
        plannedQuantity: Number(formData.plannedQuantity),
        availableQuantity: availableQty,
        producedQuantity: producedQty,
        numberOfLots: Number(formData.numberOfLots),
        finalQuantity: producedQty + availableQty,
        unit: selectedFormulation?.baseUnit || 'kg',
        productionDate: formData.productionDate,
      })
    );

    router.push('/production/stock-check');
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/production">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>

            <div>
              <h1 className="page-title flex items-center gap-2">
                <Factory className="h-6 w-6 text-primary" />
                New Production Batch
              </h1>
              <p className="text-muted-foreground mt-1">
                Step 1: Enter production details
              </p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              1
            </div>
            <span className={isMobile ? 'sr-only' : 'text-sm font-medium'}>
              Entry
            </span>
          </div>

          <div className="h-px w-8 bg-border" />

          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
              2
            </div>
            <span
              className={
                isMobile ? 'sr-only' : 'text-sm text-muted-foreground'
              }
            >
              Stock Check
            </span>
          </div>

          <div className="h-px w-8 bg-border" />

          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
              3
            </div>
            <span
              className={
                isMobile ? 'sr-only' : 'text-sm text-muted-foreground'
              }
            >
              Confirm
            </span>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Production Details</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Formulation */}
            <div className="space-y-2">
              <Label htmlFor="formulation">
                Masala / Product Name *
              </Label>

              <Popover open={isFormulationOpen} onOpenChange={setIsFormulationOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    disabled={isLoading}
                  >
                    {formData.formulationId
                      ? activeFormulations.find(
                        f => f.id === formData.formulationId
                      )?.name
                      : isLoading
                        ? 'Loading...'
                        : 'Select a masala...'}

                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search masala..." />
                    <CommandEmpty>No masala found.</CommandEmpty>

                    <CommandGroup className="max-h-60 overflow-y-auto">
                      {activeFormulations.map(f => (
                        <CommandItem
                          key={f.id}
                          value={f.name}
                          onSelect={() => {
                            setFormData({
                              ...formData,
                              formulationId: f.id,
                              plannedQuantity: f.defaultQuantity?.toString() || '',
                            });
                            setIsFormulationOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              formData.formulationId === f.id
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          {f.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Planned Production Quantity *
              </Label>
              <div className="flex gap-2">
                <Input
                  id="quantity"
                  type="number"
                  placeholder="Enter quantity"
                  value={formData.plannedQuantity}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      plannedQuantity: e.target.value,
                    })
                  }
                  min="1"
                  step="0.1"
                />
                <div className="flex items-center px-4 bg-muted rounded-md text-sm font-medium min-w-[60px] justify-center">
                  {selectedFormulation?.baseUnit || 'kg'}
                </div>
              </div>
            </div>

            {/* Available Quantity */}
            <div className="space-y-2">
              <Label htmlFor="availableQuantity">
                Available Quantity (Previously Produced)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="availableQuantity"
                  type="number"
                  placeholder="Enter available quantity"
                  value={formData.availableQuantity}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      availableQuantity: e.target.value,
                    })
                  }
                  min="0"
                  step="0.1"
                />
                <div className="flex items-center px-4 bg-muted rounded-md text-sm font-medium min-w-[60px] justify-center">
                  {selectedFormulation?.baseUnit || 'kg'}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Quantity from previous batches that will be added to this batch
              </p>
            </div>

            {/* Number of Lots */}
            <div className="space-y-2">
              <Label htmlFor="lots">Number of Lots *</Label>
              <Select
                value={formData.numberOfLots}
                onValueChange={value =>
                  setFormData({ ...formData, numberOfLots: value })
                }
              >
                <SelectTrigger id="lots">
                  <SelectValue placeholder="Select number of lots" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(num => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Final Quantity */}
            <div className="space-y-2">
              <Label htmlFor="finalQuantity">Estimated Total Output</Label>
              <div className="flex gap-2">
                <Input
                  id="finalQuantity"
                  type="number"
                  value={grossQuantity.toFixed(2)}
                  readOnly
                  className="bg-muted"
                />
                <div className="flex items-center px-4 bg-muted rounded-md text-sm font-medium min-w-[60px] justify-center">
                  {selectedFormulation?.baseUnit || 'kg'}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Production loss will be entered and calculated during confirmation.
              </p>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Production Date *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="date"
                  type="date"
                  value={formData.productionDate}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      productionDate: e.target.value,
                    })
                  }
                  className="pl-10"
                />
              </div>
            </div>

            {/* Info */}
            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="text-muted-foreground">
                <strong>Note:</strong> Production creates the masala batch.
                Enter expected production loss (spillage, waste) and material requirements will be calculated based on the net quantity after loss.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between gap-3">
          <Button variant="outline" asChild>
            <Link href="/production">Cancel</Link>
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canProceed}
            className="gap-2"
          >
            Check Stock Availability
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
