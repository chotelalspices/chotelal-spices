export interface RawMaterial {
  id: string;
  name: string;
  unit: 'kg' | 'gm';
  costPerUnit: number;
  availableStock: number;
  minimumStock: number;
  status: 'active' | 'inactive';
  description?: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  rawMaterialId: string;
  rawMaterialName: string;
  action: 'add' | 'reduce';
  quantity: number;
  balanceAfter: number;
  reason: 'purchase' | 'wastage' | 'damage' | 'correction' | 'production';
  reference?: string;
  performedBy: string;
  createdAt: string;
}

export const rawMaterials: RawMaterial[] = [
  {
    id: '1',
    name: 'Turmeric Powder',
    unit: 'kg',
    costPerUnit: 180,
    availableStock: 250,
    minimumStock: 50,
    status: 'active',
    description: 'Premium quality turmeric powder from Salem',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    name: 'Red Chilli Powder',
    unit: 'kg',
    costPerUnit: 220,
    availableStock: 180,
    minimumStock: 40,
    status: 'active',
    description: 'Guntur red chilli powder, medium spice level',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '3',
    name: 'Coriander Seeds',
    unit: 'kg',
    costPerUnit: 95,
    availableStock: 320,
    minimumStock: 60,
    status: 'active',
    description: 'Whole coriander seeds for grinding',
    createdAt: '2024-01-20T10:00:00Z',
  },
  {
    id: '4',
    name: 'Cumin Seeds',
    unit: 'kg',
    costPerUnit: 280,
    availableStock: 250,
    minimumStock: 50,
    status: 'active',
    description: 'Premium cumin seeds from Gujarat',
    createdAt: '2024-02-01T10:00:00Z',
  },
  {
    id: '5',
    name: 'Black Pepper',
    unit: 'kg',
    costPerUnit: 650,
    availableStock: 50,
    minimumStock: 25,
    status: 'active',
    description: 'Malabar black pepper',
    createdAt: '2024-02-10T10:00:00Z',
  },
  {
    id: '6',
    name: 'Salt (Refined)',
    unit: 'kg',
    costPerUnit: 18,
    availableStock: 500,
    minimumStock: 100,
    status: 'active',
    description: 'Industrial grade refined salt',
    createdAt: '2024-02-15T10:00:00Z',
  },
  {
    id: '7',
    name: 'Fenugreek Seeds',
    unit: 'kg',
    costPerUnit: 120,
    availableStock: 85,
    minimumStock: 30,
    status: 'active',
    description: 'Methi seeds for masala blends',
    createdAt: '2024-03-01T10:00:00Z',
  },
  {
    id: '8',
    name: 'Mustard Seeds',
    unit: 'kg',
    costPerUnit: 85,
    availableStock: 5,
    minimumStock: 40,
    status: 'inactive',
    description: 'Yellow mustard seeds - temporarily unavailable',
    createdAt: '2024-03-05T10:00:00Z',
  },
  {
    id: '9',
    name: 'Cardamom (Green)',
    unit: 'kg',
    costPerUnit: 3.5,
    availableStock: 20,
    minimumStock: 500,
    status: 'active',
    description: 'Premium green cardamom from Kerala',
    createdAt: '2024-03-10T10:00:00Z',
  },
  {
    id: '10',
    name: 'Cloves',
    unit: 'kg',
    costPerUnit: 1.8,
    availableStock: 20,
    minimumStock: 400,
    status: 'active',
    description: 'Whole cloves for garam masala',
    createdAt: '2024-03-15T10:00:00Z',
  },
  {
    id: '11',
    name: 'Cinnamon Sticks',
    unit: 'kg',
    costPerUnit: 420,
    availableStock: 35,
    minimumStock: 20,
    status: 'active',
    description: 'Ceylon cinnamon sticks',
    createdAt: '2024-03-20T10:00:00Z',
  },
  {
    id: '12',
    name: 'Dry Ginger Powder',
    unit: 'kg',
    costPerUnit: 195,
    availableStock: 200,
    minimumStock: 30,
    status: 'active',
    description: 'Sonth powder for masala blends',
    createdAt: '2024-04-01T10:00:00Z',
  },
];

export const stockMovements: StockMovement[] = [
  {
    id: '1',
    rawMaterialId: '1',
    rawMaterialName: 'Turmeric Powder',
    action: 'add',
    quantity: 100,
    balanceAfter: 250,
    reason: 'purchase',
    reference: 'PO-2024-0156',
    performedBy: 'Rajesh Kumar',
    createdAt: '2024-12-26T14:30:00Z',
  },
  {
    id: '2',
    rawMaterialId: '2',
    rawMaterialName: 'Red Chilli Powder',
    action: 'reduce',
    quantity: 25,
    balanceAfter: 180,
    reason: 'production',
    reference: 'BATCH-1245',
    performedBy: 'Suresh Patel',
    createdAt: '2024-12-26T11:15:00Z',
  },
  {
    id: '3',
    rawMaterialId: '5',
    rawMaterialName: 'Black Pepper',
    action: 'reduce',
    quantity: 15,
    balanceAfter: 0,
    reason: 'production',
    reference: 'BATCH-1244',
    performedBy: 'Suresh Patel',
    createdAt: '2024-12-25T16:45:00Z',
  },
  {
    id: '4',
    rawMaterialId: '4',
    rawMaterialName: 'Cumin Seeds',
    action: 'reduce',
    quantity: 5,
    balanceAfter: 45,
    reason: 'wastage',
    reference: 'Quality check failure',
    performedBy: 'Amit Sharma',
    createdAt: '2024-12-25T10:00:00Z',
  },
  {
    id: '5',
    rawMaterialId: '6',
    rawMaterialName: 'Salt (Refined)',
    action: 'add',
    quantity: 200,
    balanceAfter: 500,
    reason: 'purchase',
    reference: 'PO-2024-0155',
    performedBy: 'Rajesh Kumar',
    createdAt: '2024-12-24T09:30:00Z',
  },
  {
    id: '6',
    rawMaterialId: '3',
    rawMaterialName: 'Coriander Seeds',
    action: 'add',
    quantity: 50,
    balanceAfter: 320,
    reason: 'purchase',
    reference: 'PO-2024-0154',
    performedBy: 'Rajesh Kumar',
    createdAt: '2024-12-23T15:20:00Z',
  },
  {
    id: '7',
    rawMaterialId: '9',
    rawMaterialName: 'Cardamom (Green)',
    action: 'reduce',
    quantity: 300,
    balanceAfter: 2500,
    reason: 'production',
    reference: 'BATCH-1243',
    performedBy: 'Suresh Patel',
    createdAt: '2024-12-23T11:00:00Z',
  },
  {
    id: '8',
    rawMaterialId: '12',
    rawMaterialName: 'Dry Ginger Powder',
    action: 'reduce',
    quantity: 2,
    balanceAfter: 28,
    reason: 'damage',
    reference: 'Moisture damage in storage',
    performedBy: 'Amit Sharma',
    createdAt: '2024-12-22T14:10:00Z',
  },
  {
    id: '9',
    rawMaterialId: '7',
    rawMaterialName: 'Fenugreek Seeds',
    action: 'add',
    quantity: 30,
    balanceAfter: 85,
    reason: 'correction',
    reference: 'Stock reconciliation',
    performedBy: 'Priya Mehta',
    createdAt: '2024-12-22T10:45:00Z',
  },
  {
    id: '10',
    rawMaterialId: '10',
    rawMaterialName: 'Cloves',
    action: 'reduce',
    quantity: 200,
    balanceAfter: 1800,
    reason: 'production',
    reference: 'BATCH-1242',
    performedBy: 'Suresh Patel',
    createdAt: '2024-12-21T16:30:00Z',
  },
];

// Helper functions
export const getStockStatus = (material: RawMaterial): 'normal' | 'low' | 'out' => {
  if (material.availableStock <= 0) return 'out';
  if (material.availableStock <= material.minimumStock) return 'low';
  return 'normal';
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(amount);
};

export const formatQuantity = (quantity: number, unit: 'kg' | 'gm'): string => {
  return `${quantity.toLocaleString('en-IN')} ${unit}`;
};

export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};
