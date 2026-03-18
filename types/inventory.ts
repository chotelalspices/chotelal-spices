export interface RawMaterial {
  id: string;
  name: string;
  unit: 'kg' | 'gm';
  status: 'active' | 'inactive';
  costPerUnit?: number;
  availableStock?: number;
}

export interface StockMovement {
  id: string;
  rawMaterialId: string;
  rawMaterialName: string;
  action: 'add' | 'reduce';
  quantity: number;
  reason: 'purchase' | 'wastage' | 'damage' | 'correction' | 'production';
  reference?: string;
  performedBy: string;
  createdAt: string;
  // Cost tracking — populated when a purchase changes the unit cost
  previousCostPerUnit?: number;
  newCostPerUnit?: number;
}

export interface LabelMovement {
  id: string;
  labelId: string;
  labelName: string;
  action: 'add' | 'reduce';
  quantity: number;
  reason: string;
  remarks?: string;
  adjustmentDate: string;
  createdAt: string;
  performedBy?: string;
  // Cost tracking — populated when a purchase changes the unit cost
  previousCostPerUnit?: number;
  newCostPerUnit?: number;
}

export interface StockMovementFilters {
  materialId: string;
  type: string;
  dateFrom: string;
  dateTo: string;
}