import { rawMaterials, formatCurrency, formatQuantity } from './sampleData';
import { formulations, calculateFormulationCosts, Formulation } from './formulationData';

export interface MaterialRequirement {
  rawMaterialId: string;
  rawMaterialName: string;
  requiredQuantity: number;
  actualQuantity: number; // User can manually adjust this
  unit: 'kg' | 'gm';
  availableStock: number;
  stockStatus: 'sufficient' | 'insufficient';
  ratePerUnit: number;
  cost: number;
  isChecked?: boolean;
  status: 'active' | 'inactive';
  originalRawMaterialId?: string; // Track the original material from formulation
  originalRawMaterialName?: string; // Store original material name
  originalRatePerUnit?: number; // Store original rate
  originalAvailableStock?: number; // Store original stock
  originalStatus?: 'active' | 'inactive'; // Store original status
  alternativeRawMaterials?: Array<{
    id: string;
    name: string;
    unit: 'kg' | 'gm';
    costPerUnit: number;
    availableStock: number;
    status: 'active' | 'inactive';
  }>;
}

export interface PlannedProduction {
  id: string;
  formulationId: string;
  formulationName: string;
  plannedQuantity: number;
  unit: 'kg' | 'gm';
  plannedDate: string;
  materialStatus: 'sufficient' | 'insufficient';
  insufficientMaterials: string[];
  emailSent: boolean;
  createdBy: string;
  createdAt: string;
}

export interface ProductionBatch {
  id: string;
  batchNumber: string;
  formulationId: string;
  formulationName: string;
  plannedQuantity: number;
  unit: 'kg' | 'gm';
  expectedLossPercent: number;
  lossQuantity: number;
  finalOutputQuantity: number;
  totalRawMaterialConsumed: number;
  totalProductionCost: number;
  costPerKg: number;
  materialRequirements: MaterialRequirement[];
  productionDate: string;
  status: 'draft' | 'confirmed';
  confirmedBy?: string;
  confirmedAt?: string;
  createdAt: string;
}

// Sample production batches
export const productionBatches: ProductionBatch[] = [
  {
    id: '1',
    batchNumber: 'BATCH-2024-001',
    formulationId: '1',
    formulationName: 'Garam Masala',
    plannedQuantity: 50,
    unit: 'kg',
    expectedLossPercent: 2,
    lossQuantity: 1,
    finalOutputQuantity: 49,
    totalRawMaterialConsumed: 50,
    totalProductionCost: 12500,
    costPerKg: 255.10,
    materialRequirements: [],
    productionDate: '2024-12-20',
    status: 'confirmed',
    confirmedBy: 'Suresh Patel',
    confirmedAt: '2024-12-20T14:30:00Z',
    createdAt: '2024-12-20T10:00:00Z',
  },
  {
    id: '2',
    batchNumber: 'BATCH-2024-002',
    formulationId: '2',
    formulationName: 'Chaat Masala',
    plannedQuantity: 25,
    unit: 'kg',
    expectedLossPercent: 1.5,
    lossQuantity: 0.375,
    finalOutputQuantity: 24.625,
    totalRawMaterialConsumed: 25,
    totalProductionCost: 4200,
    costPerKg: 170.56,
    materialRequirements: [],
    productionDate: '2024-12-22',
    status: 'confirmed',
    confirmedBy: 'Rajesh Kumar',
    confirmedAt: '2024-12-22T11:45:00Z',
    createdAt: '2024-12-22T09:30:00Z',
  },
  {
    id: '3',
    batchNumber: 'BATCH-2024-003',
    formulationId: '3',
    formulationName: 'Sambhar Masala',
    plannedQuantity: 100,
    unit: 'kg',
    expectedLossPercent: 2.5,
    lossQuantity: 2.5,
    finalOutputQuantity: 97.5,
    totalRawMaterialConsumed: 100,
    totalProductionCost: 15800,
    costPerKg: 162.05,
    materialRequirements: [],
    productionDate: '2024-12-25',
    status: 'confirmed',
    confirmedBy: 'Suresh Patel',
    confirmedAt: '2024-12-25T16:00:00Z',
    createdAt: '2024-12-25T12:00:00Z',
  },
];

// Generate a new batch number
export const generateBatchNumber = (): string => {
  const year = new Date().getFullYear();
  const existingNumbers = productionBatches
    .filter(b => b.batchNumber.includes(String(year)))
    .map(b => {
      const match = b.batchNumber.match(/BATCH-\d{4}-(\d{3})/);
      return match ? parseInt(match[1], 10) : 0;
    });
  const nextNumber = Math.max(0, ...existingNumbers) + 1;
  return `BATCH-${year}-${String(nextNumber).padStart(3, '0')}`;
};

// Calculate material requirements for a production batch
export const calculateMaterialRequirements = (
  formulation: Formulation,
  plannedQuantity: number
): MaterialRequirement[] => {
  const requirements: MaterialRequirement[] = [];
  const scaleFactor = plannedQuantity / formulation.baseQuantity;

  formulation.ingredients.forEach(ingredient => {
    const rawMaterial = rawMaterials.find(rm => rm.id === ingredient.rawMaterialId);
    if (!rawMaterial) return;

    // Calculate required quantity based on percentage
    const baseRequiredQty = (ingredient.percentage / 100) * formulation.baseQuantity;
    const requiredQuantity = baseRequiredQty * scaleFactor;

    // Convert units if necessary for stock comparison
    let availableInSameUnit = rawMaterial.availableStock;
    if (formulation.baseUnit !== rawMaterial.unit) {
      if (formulation.baseUnit === 'kg' && rawMaterial.unit === 'gm') {
        // Required is in kg, stock is in gm - convert stock to kg
        availableInSameUnit = rawMaterial.availableStock / 1000;
      } else {
        // Required is in gm, stock is in kg - convert stock to gm
        availableInSameUnit = rawMaterial.availableStock * 1000;
      }
    }

    const stockStatus: 'sufficient' | 'insufficient' = 
      availableInSameUnit >= requiredQuantity ? 'sufficient' : 'insufficient';

    // Calculate cost
    let cost: number;
    if (formulation.baseUnit === rawMaterial.unit) {
      cost = requiredQuantity * rawMaterial.costPerUnit;
    } else if (formulation.baseUnit === 'kg' && rawMaterial.unit === 'gm') {
      cost = (requiredQuantity * 1000) * rawMaterial.costPerUnit;
    } else {
      cost = (requiredQuantity / 1000) * rawMaterial.costPerUnit;
    }

    requirements.push({
      rawMaterialId: rawMaterial.id,
      rawMaterialName: rawMaterial.name,
      requiredQuantity,
      actualQuantity: requiredQuantity, // Default to required quantity
      unit: formulation.baseUnit,
      availableStock: rawMaterial.availableStock,
      stockStatus,
      ratePerUnit: rawMaterial.costPerUnit,
      cost,
      status: rawMaterial.status,
    });
  });

  return requirements;
};

// Calculate batch summary
export const calculateBatchSummary = (
  plannedQuantity: number,
  expectedLossPercent: number,
  materialRequirements: MaterialRequirement[]
): {
  lossQuantity: number;
  finalOutputQuantity: number;
  totalRawMaterialConsumed: number;
  totalProductionCost: number;
  costPerKg: number;
} => {
  const lossQuantity = (expectedLossPercent / 100) * plannedQuantity;
  const finalOutputQuantity = plannedQuantity - lossQuantity;
  const totalRawMaterialConsumed = materialRequirements.reduce(
    (sum, req) => sum + req.requiredQuantity, 
    0
  );
  const totalProductionCost = materialRequirements.reduce(
    (sum, req) => sum + req.cost, 
    0
  );
  const costPerKg = finalOutputQuantity > 0 ? totalProductionCost / finalOutputQuantity : 0;

  return {
    lossQuantity,
    finalOutputQuantity,
    totalRawMaterialConsumed,
    totalProductionCost,
    costPerKg,
  };
};

// Check if all materials have sufficient stock
export const hasInsufficientStock = (requirements: MaterialRequirement[]): boolean => {
  return requirements.some(req => req.stockStatus === 'insufficient');
};

// Get active formulations for dropdown
export const getActiveFormulations = (): Formulation[] => {
  return formulations.filter(f => f.status === 'active');
};

export { formatCurrency, formatQuantity };

export const checkMaterialAvailability = (
  formulation: Formulation,
  plannedQuantity: number
): { sufficient: boolean; insufficientMaterials: string[] } => {
  const requirements = calculateMaterialRequirements(formulation, plannedQuantity);
  const insufficientMaterials = requirements
    .filter(req => req.stockStatus === 'insufficient')
    .map(req => req.rawMaterialName);
  
  return {
    sufficient: insufficientMaterials.length === 0,
    insufficientMaterials,
  };
};

export const plannedProductions: PlannedProduction[] = [
  {
    id: 'plan-1',
    formulationId: '1',
    formulationName: 'Garam Masala',
    plannedQuantity: 100,
    unit: 'kg',
    plannedDate: '2025-01-10',
    materialStatus: 'sufficient',
    insufficientMaterials: [],
    emailSent: false,
    createdBy: 'Production Manager',
    createdAt: '2024-12-30T09:00:00Z',
  },
  {
    id: 'plan-2',
    formulationId: '4',
    formulationName: 'Turmeric Powder Blend',
    plannedQuantity: 200,
    unit: 'kg',
    plannedDate: '2025-01-12',
    materialStatus: 'insufficient',
    insufficientMaterials: ['Turmeric'],
    emailSent: true,
    createdBy: 'Production Manager',
    createdAt: '2024-12-30T10:00:00Z',
  },
];

export const allSufficientMaterialsChecked = (requirements: MaterialRequirement[]): boolean => {
  return requirements
    .every(req => req.isChecked === true);
};

// Check if any materials are inactive
export const hasInactiveMaterials = (requirements: MaterialRequirement[]): boolean => {
  return requirements.some(req => req.status === 'inactive');
};

// Get inactive material names
export const getInactiveMaterials = (requirements: MaterialRequirement[]): string[] => {
  return requirements
    .filter(req => req.status === 'inactive')
    .map(req => req.rawMaterialName);
};