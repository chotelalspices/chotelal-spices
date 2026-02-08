export interface RawMaterial {
  id: string;
  name: string;
  unit: 'kg' | 'gm';
  status: 'active' | 'inactive';
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
}

export interface StockMovementFilters {
  materialId: string;
  type: string;
  dateFrom: string;
  dateTo: string;
}
