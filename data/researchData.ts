// Formulation Research Data

import { FormulationIngredient } from './formulationData';

export type ResearchStatus = 'pending' | 'approved' | 'rejected';

export interface ResearchFormulation {
  id: string;
  tempName: string;
  researcherName: string;
  researchDate: string;
  baseQuantity: number;
  baseUnit: 'kg' | 'gm';
  ingredients: FormulationIngredient[];
  notes: string;
  status: ResearchStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

// Sample research formulations
export const researchFormulations: ResearchFormulation[] = [
  {
    id: 'res-1',
    tempName: 'Experimental Biryani Masala v1',
    researcherName: 'Amit Sharma',
    researchDate: '2024-12-28',
    baseQuantity: 100,
    baseUnit: 'kg',
    ingredients: [
      { rawMaterialId: '4', percentage: 20 }, // Cumin Seeds
      { rawMaterialId: '3', percentage: 18 }, // Coriander Seeds
      { rawMaterialId: '9', percentage: 15 }, // Cardamom
      { rawMaterialId: '11', percentage: 12 }, // Cinnamon
      { rawMaterialId: '10', percentage: 10 }, // Cloves
      { rawMaterialId: '5', percentage: 10 }, // Black Pepper
      { rawMaterialId: '7', percentage: 8 },  // Fenugreek Seeds
      { rawMaterialId: '12', percentage: 7 }, // Dry Ginger
    ],
    notes: 'Testing new ratio for premium biryani masala with enhanced cardamom and cinnamon notes.',
    status: 'pending',
    createdAt: '2024-12-28T10:00:00Z',
  },
  {
    id: 'res-2',
    tempName: 'Low-Salt Chaat Masala',
    researcherName: 'Priya Patel',
    researchDate: '2024-12-25',
    baseQuantity: 50,
    baseUnit: 'kg',
    ingredients: [
      { rawMaterialId: '4', percentage: 35 }, // Cumin Seeds
      { rawMaterialId: '6', percentage: 15 }, // Salt (reduced)
      { rawMaterialId: '3', percentage: 25 }, // Coriander Seeds
      { rawMaterialId: '2', percentage: 10 }, // Red Chilli
      { rawMaterialId: '12', percentage: 10 }, // Dry Ginger
      { rawMaterialId: '5', percentage: 5 },  // Black Pepper
    ],
    notes: 'Health-conscious variant with 40% less salt than standard recipe.',
    status: 'approved',
    reviewedBy: 'Suresh Kumar (Admin)',
    reviewedAt: '2024-12-27T14:00:00Z',
    createdAt: '2024-12-25T11:30:00Z',
  },
  {
    id: 'res-3',
    tempName: 'Extra Hot Tikka Masala',
    researcherName: 'Rahul Singh',
    researchDate: '2024-12-20',
    baseQuantity: 100,
    baseUnit: 'kg',
    ingredients: [
      { rawMaterialId: '2', percentage: 40 }, // Red Chilli (extra)
      { rawMaterialId: '3', percentage: 20 }, // Coriander Seeds
      { rawMaterialId: '4', percentage: 15 }, // Cumin Seeds
      { rawMaterialId: '1', percentage: 10 }, // Turmeric
      { rawMaterialId: '5', percentage: 10 }, // Black Pepper
      { rawMaterialId: '12', percentage: 5 }, // Dry Ginger
    ],
    notes: 'Extreme heat variant for specialty market. May need capsaicin level testing.',
    status: 'rejected',
    reviewedBy: 'Suresh Kumar (Admin)',
    reviewedAt: '2024-12-22T09:30:00Z',
    rejectionReason: 'Capsaicin levels exceed safety guidelines. Please reduce chilli percentage to max 30%.',
    createdAt: '2024-12-20T15:00:00Z',
  },
];

// Helper functions
export const getResearchFormulationById = (id: string): ResearchFormulation | undefined => {
  return researchFormulations.find(r => r.id === id);
};

export const getPendingResearchFormulations = (): ResearchFormulation[] => {
  return researchFormulations.filter(r => r.status === 'pending');
};

export const getApprovedResearchFormulations = (): ResearchFormulation[] => {
  return researchFormulations.filter(r => r.status === 'approved');
};

export const getStatusColor = (status: ResearchStatus): string => {
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

export const getStatusLabel = (status: ResearchStatus): string => {
  switch (status) {
    case 'pending': return 'Pending Review';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    default: return status;
  }
};

export const generateResearchId = (): string => {
  const timestamp = Date.now();
  return `res-${timestamp}`;
};
