import { rawMaterials, formatCurrency } from './sampleData';

export interface FormulationIngredient {
  rawMaterialId: string;
  percentage: number;
}

export interface Formulation {
  id: string;
  name: string;
  baseQuantity: number;
  baseUnit: 'kg' | 'gm';
  defaultQuantity: number;
  ingredients: FormulationIngredient[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export const formulations: Formulation[] = [
  {
    id: '1',
    name: 'Garam Masala',
    baseQuantity: 100,
    baseUnit: 'kg',
    defaultQuantity: 100,
    ingredients: [
      { rawMaterialId: '4', percentage: 25 },  // Cumin Seeds
      { rawMaterialId: '3', percentage: 20 },  // Coriander Seeds
      { rawMaterialId: '5', percentage: 15 },  // Black Pepper
      { rawMaterialId: '9', percentage: 10 },  // Cardamom
      { rawMaterialId: '10', percentage: 10 }, // Cloves
      { rawMaterialId: '11', percentage: 10 }, // Cinnamon
      { rawMaterialId: '7', percentage: 5 },   // Fenugreek Seeds
      { rawMaterialId: '12', percentage: 5 },  // Dry Ginger
    ],
    status: 'active',
    createdAt: '2024-06-15T10:00:00Z',
    updatedAt: '2024-12-20T14:30:00Z',
  },
  {
    id: '2',
    name: 'Chaat Masala',
    baseQuantity: 50,
    baseUnit: 'kg',
    defaultQuantity: 50,
    ingredients: [
      { rawMaterialId: '4', percentage: 30 },  // Cumin Seeds
      { rawMaterialId: '6', percentage: 25 },  // Salt
      { rawMaterialId: '3', percentage: 20 },  // Coriander Seeds
      { rawMaterialId: '2', percentage: 10 },  // Red Chilli
      { rawMaterialId: '12', percentage: 10 }, // Dry Ginger
      { rawMaterialId: '5', percentage: 5 },   // Black Pepper
    ],
    status: 'active',
    createdAt: '2024-07-01T10:00:00Z',
    updatedAt: '2024-12-15T11:00:00Z',
  },
  {
    id: '3',
    name: 'Sambhar Masala',
    baseQuantity: 100,
    baseUnit: 'kg',
    defaultQuantity: 100,
    ingredients: [
      { rawMaterialId: '3', percentage: 35 },  // Coriander Seeds
      { rawMaterialId: '2', percentage: 25 },  // Red Chilli
      { rawMaterialId: '4', percentage: 15 },  // Cumin Seeds
      { rawMaterialId: '1', percentage: 10 },  // Turmeric
      { rawMaterialId: '7', percentage: 8 },   // Fenugreek Seeds
      { rawMaterialId: '5', percentage: 5 },   // Black Pepper
      { rawMaterialId: '8', percentage: 2 },   // Mustard Seeds
    ],
    status: 'active',
    createdAt: '2024-08-10T10:00:00Z',
    updatedAt: '2024-12-10T09:45:00Z',
  },
  {
    id: '4',
    name: 'Turmeric Powder Blend',
    baseQuantity: 100,
    baseUnit: 'kg',
    defaultQuantity: 100,
    ingredients: [
      { rawMaterialId: '1', percentage: 85 },  // Turmeric
      { rawMaterialId: '3', percentage: 10 },  // Coriander Seeds
      { rawMaterialId: '7', percentage: 5 },   // Fenugreek Seeds
    ],
    status: 'active',
    createdAt: '2024-09-01T10:00:00Z',
    updatedAt: '2024-11-28T16:20:00Z',
  },
  {
    id: '5',
    name: 'Kitchen King Masala',
    baseQuantity: 100,
    baseUnit: 'kg',
    defaultQuantity: 100,
    ingredients: [
      { rawMaterialId: '3', percentage: 25 },  // Coriander Seeds
      { rawMaterialId: '4', percentage: 20 },  // Cumin Seeds
      { rawMaterialId: '2', percentage: 15 },  // Red Chilli
      { rawMaterialId: '1', percentage: 10 },  // Turmeric
      { rawMaterialId: '12', percentage: 10 }, // Dry Ginger
      { rawMaterialId: '9', percentage: 8 },   // Cardamom
      { rawMaterialId: '10', percentage: 7 },  // Cloves
      { rawMaterialId: '11', percentage: 5 },  // Cinnamon
    ],
    status: 'active',
    createdAt: '2024-10-05T10:00:00Z',
    updatedAt: '2024-12-22T10:15:00Z',
  },
  {
    id: '6',
    name: 'Pav Bhaji Masala',
    baseQuantity: 50,
    baseUnit: 'kg',
    defaultQuantity: 50,
    ingredients: [
      { rawMaterialId: '3', percentage: 30 },  // Coriander Seeds
      { rawMaterialId: '2', percentage: 25 },  // Red Chilli
      { rawMaterialId: '4', percentage: 15 },  // Cumin Seeds
      { rawMaterialId: '9', percentage: 10 },  // Cardamom
      { rawMaterialId: '10', percentage: 8 },  // Cloves
      { rawMaterialId: '11', percentage: 7 },  // Cinnamon
      { rawMaterialId: '12', percentage: 5 },  // Dry Ginger
    ],
    status: 'inactive',
    createdAt: '2024-11-01T10:00:00Z',
    updatedAt: '2024-12-01T14:00:00Z',
  },
];

// Helper functions for formulation calculations
export interface CalculatedIngredient {
  rawMaterialId: string;
  rawMaterialName: string;
  percentage: number;
  quantity: number;
  unit: 'kg' | 'gm';
  ratePerUnit: number;
  costContribution: number;
}

export const calculateFormulationCosts = (
  ingredients: FormulationIngredient[],
  baseQuantity: number,
  baseUnit: 'kg' | 'gm'
): { 
  calculatedIngredients: CalculatedIngredient[]; 
  totalCost: number; 
  costPerKg: number;
  totalPercentage: number;
} => {
  const calculatedIngredients: CalculatedIngredient[] = [];
  let totalCost = 0;
  let totalPercentage = 0;

  ingredients.forEach(ingredient => {
    const rawMaterial = rawMaterials.find(rm => rm.id === ingredient.rawMaterialId);
    if (!rawMaterial) return;

    totalPercentage += ingredient.percentage;

    // Calculate quantity based on percentage
    const quantity = (ingredient.percentage / 100) * baseQuantity;

    // Calculate cost contribution
    // Need to convert units if necessary
    let costContribution: number;
    if (baseUnit === rawMaterial.unit) {
      costContribution = quantity * rawMaterial.costPerUnit;
    } else if (baseUnit === 'kg' && rawMaterial.unit === 'gm') {
      // Base is kg, material is priced per gm
      // Convert kg to gm for cost calculation
      costContribution = (quantity * 1000) * rawMaterial.costPerUnit;
    } else {
      // Base is gm, material is priced per kg
      // Convert gm to kg for cost calculation
      costContribution = (quantity / 1000) * rawMaterial.costPerUnit;
    }

    totalCost += costContribution;

    calculatedIngredients.push({
      rawMaterialId: ingredient.rawMaterialId,
      rawMaterialName: rawMaterial.name,
      percentage: ingredient.percentage,
      quantity,
      unit: baseUnit,
      ratePerUnit: rawMaterial.costPerUnit,
      costContribution,
    });
  });

  // Calculate cost per kg
  const baseInKg = baseUnit === 'kg' ? baseQuantity : baseQuantity / 1000;
  const costPerKg = baseInKg > 0 ? totalCost / baseInKg : 0;

  return { calculatedIngredients, totalCost, costPerKg, totalPercentage };
};

export const getFormulationById = (id: string): Formulation | undefined => {
  return formulations.find(f => f.id === id);
};

// Product name suggestions (masala types that can be created)
export const masalaTypes = [
  'Garam Masala',
  'Chaat Masala',
  'Sambhar Masala',
  'Rasam Powder',
  'Turmeric Powder Blend',
  'Kitchen King Masala',
  'Pav Bhaji Masala',
  'Biryani Masala',
  'Chicken Masala',
  'Fish Masala',
  'Chole Masala',
  'Paneer Masala',
  'Meat Masala',
  'Tandoori Masala',
  'Chana Masala',
  'Kadai Masala',
  'Curry Powder',
  'Pickle Masala',
];
