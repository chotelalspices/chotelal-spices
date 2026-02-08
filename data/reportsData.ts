// Reports Data Types and Sample Data

export interface InventoryReportItem {
  id: string;
  materialName: string;
  category: string;
  availableStock: number;
  unit: string;
  minimumThreshold: number;
  status: 'in-stock' | 'low' | 'critical' | 'out';
  lastUpdated: string;
}

export interface ProductionReportItem {
  id: string;
  batchNumber: string;
  productName: string;
  producedQuantity: number;
  unit: string;
  productionDate: string;
  productionCost: number;
  status: 'completed' | 'confirmed';
}

export interface PackagingLossReportItem {
  id: string;
  batchNumber: string;
  productName: string;
  totalProduced: number;
  totalPackaged: number;
  packagingLoss: number;
  remainingLoose: number;
  lossPercentage: number;
  packagingDate: string;
}

export interface SalesProfitReportItem {
  id: string;
  saleDate: string;
  productName: string;
  quantitySold: number;
  unit: string;
  sellingPrice: number;
  revenue: number;
  productionCost: number;
  profit: number;
  profitMargin: number;
}

export interface ReportSummary {
  totalItems: number;
  totalValue: number;
  averageValue: number;
  period: string;
}

// Sample Inventory Report Data
export const sampleInventoryReport: InventoryReportItem[] = [
  { id: 'INV001', materialName: 'Coriander Seeds', category: 'Whole Spices', availableStock: 150, unit: 'kg', minimumThreshold: 50, status: 'in-stock', lastUpdated: '2024-12-28' },
  { id: 'INV002', materialName: 'Red Chilli Powder', category: 'Ground Spices', availableStock: 45, unit: 'kg', minimumThreshold: 40, status: 'low', lastUpdated: '2024-12-28' },
  { id: 'INV003', materialName: 'Turmeric Powder', category: 'Ground Spices', availableStock: 80, unit: 'kg', minimumThreshold: 30, status: 'in-stock', lastUpdated: '2024-12-27' },
  { id: 'INV004', materialName: 'Cumin Seeds', category: 'Whole Spices', availableStock: 25, unit: 'kg', minimumThreshold: 35, status: 'critical', lastUpdated: '2024-12-28' },
  { id: 'INV005', materialName: 'Salt', category: 'Basic', availableStock: 200, unit: 'kg', minimumThreshold: 100, status: 'in-stock', lastUpdated: '2024-12-26' },
  { id: 'INV006', materialName: 'Fennel Seeds', category: 'Whole Spices', availableStock: 0, unit: 'kg', minimumThreshold: 20, status: 'out', lastUpdated: '2024-12-28' },
  { id: 'INV007', materialName: 'Black Pepper', category: 'Whole Spices', availableStock: 35, unit: 'kg', minimumThreshold: 25, status: 'in-stock', lastUpdated: '2024-12-27' },
  { id: 'INV008', materialName: 'Garam Masala Base', category: 'Blends', availableStock: 60, unit: 'kg', minimumThreshold: 40, status: 'in-stock', lastUpdated: '2024-12-28' },
];

// Sample Production Report Data
export const sampleProductionReport: ProductionReportItem[] = [
  { id: 'PRD001', batchNumber: 'BATCH-2024-001', productName: 'Garam Masala', producedQuantity: 50, unit: 'kg', productionDate: '2024-12-28', productionCost: 15000, status: 'confirmed' },
  { id: 'PRD002', batchNumber: 'BATCH-2024-002', productName: 'Chaat Masala', producedQuantity: 30, unit: 'kg', productionDate: '2024-12-27', productionCost: 8500, status: 'confirmed' },
  { id: 'PRD003', batchNumber: 'BATCH-2024-003', productName: 'Sambhar Masala', producedQuantity: 40, unit: 'kg', productionDate: '2024-12-26', productionCost: 11000, status: 'confirmed' },
  { id: 'PRD004', batchNumber: 'BATCH-2024-004', productName: 'Kitchen King', producedQuantity: 25, unit: 'kg', productionDate: '2024-12-25', productionCost: 7200, status: 'confirmed' },
  { id: 'PRD005', batchNumber: 'BATCH-2024-005', productName: 'Pav Bhaji Masala', producedQuantity: 35, unit: 'kg', productionDate: '2024-12-24', productionCost: 9800, status: 'confirmed' },
];

// Sample Packaging & Loss Report Data
export const samplePackagingLossReport: PackagingLossReportItem[] = [
  { id: 'PKG001', batchNumber: 'BATCH-2024-001', productName: 'Garam Masala', totalProduced: 50, totalPackaged: 48.5, packagingLoss: 0.8, remainingLoose: 0.7, lossPercentage: 1.6, packagingDate: '2024-12-28' },
  { id: 'PKG002', batchNumber: 'BATCH-2024-002', productName: 'Chaat Masala', totalProduced: 30, totalPackaged: 29.2, packagingLoss: 0.5, remainingLoose: 0.3, lossPercentage: 1.67, packagingDate: '2024-12-27' },
  { id: 'PKG003', batchNumber: 'BATCH-2024-003', productName: 'Sambhar Masala', totalProduced: 40, totalPackaged: 38.8, packagingLoss: 0.7, remainingLoose: 0.5, lossPercentage: 1.75, packagingDate: '2024-12-26' },
  { id: 'PKG004', batchNumber: 'BATCH-2024-004', productName: 'Kitchen King', totalProduced: 25, totalPackaged: 24.3, packagingLoss: 0.4, remainingLoose: 0.3, lossPercentage: 1.6, packagingDate: '2024-12-25' },
];

// Sample Sales & Profit Report Data
export const sampleSalesProfitReport: SalesProfitReportItem[] = [
  { id: 'SALE001', saleDate: '2024-12-28', productName: 'Garam Masala 100g', quantitySold: 150, unit: 'packets', sellingPrice: 85, revenue: 12750, productionCost: 7500, profit: 5250, profitMargin: 41.18 },
  { id: 'SALE002', saleDate: '2024-12-28', productName: 'Chaat Masala 50g', quantitySold: 200, unit: 'packets', sellingPrice: 45, revenue: 9000, productionCost: 5200, profit: 3800, profitMargin: 42.22 },
  { id: 'SALE003', saleDate: '2024-12-27', productName: 'Sambhar Masala 200g', quantitySold: 80, unit: 'packets', sellingPrice: 120, revenue: 9600, productionCost: 5600, profit: 4000, profitMargin: 41.67 },
  { id: 'SALE004', saleDate: '2024-12-27', productName: 'Kitchen King 100g', quantitySold: 120, unit: 'packets', sellingPrice: 75, revenue: 9000, productionCost: 5400, profit: 3600, profitMargin: 40.00 },
  { id: 'SALE005', saleDate: '2024-12-26', productName: 'Pav Bhaji Masala 100g', quantitySold: 90, unit: 'packets', sellingPrice: 70, revenue: 6300, productionCost: 3780, profit: 2520, profitMargin: 40.00 },
  { id: 'SALE006', saleDate: '2024-12-25', productName: 'Garam Masala 200g', quantitySold: 60, unit: 'packets', sellingPrice: 160, revenue: 9600, productionCost: 5760, profit: 3840, profitMargin: 40.00 },
];

// Report type definitions
export type ReportType = 'inventory' | 'production' | 'packaging-loss' | 'sales-profit';

export interface ReportConfig {
  id: ReportType;
  name: string;
  description: string;
  icon: string;
  adminOnly: boolean;
}

export const reportConfigs: ReportConfig[] = [
  { id: 'inventory', name: 'Inventory Report', description: 'Raw materials stock levels and status', icon: 'Package', adminOnly: false },
  { id: 'production', name: 'Production Report', description: 'Production batches and costs', icon: 'Factory', adminOnly: false },
  { id: 'packaging-loss', name: 'Packaging & Loss Report', description: 'Packaging output and loss analysis', icon: 'PackageCheck', adminOnly: false },
  { id: 'sales-profit', name: 'Sales & Profit Report', description: 'Revenue, sales, and profit margins', icon: 'TrendingUp', adminOnly: true },
];

// Helper functions
export const getInventoryStatusColor = (status: InventoryReportItem['status']): string => {
  switch (status) {
    case 'in-stock': return 'text-success';
    case 'low': return 'text-warning';
    case 'critical': return 'text-destructive';
    case 'out': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
};

export const getInventoryStatusLabel = (status: InventoryReportItem['status']): string => {
  switch (status) {
    case 'in-stock': return 'In Stock';
    case 'low': return 'Low Stock';
    case 'critical': return 'Critical';
    case 'out': return 'Out of Stock';
    default: return status;
  }
};

export const calculateInventorySummary = (items: InventoryReportItem[]): ReportSummary => {
  const totalStock = items.reduce((sum, item) => sum + item.availableStock, 0);
  return {
    totalItems: items.length,
    totalValue: totalStock,
    averageValue: totalStock / items.length,
    period: 'Current',
  };
};

export const calculateProductionSummary = (items: ProductionReportItem[]): ReportSummary => {
  const totalCost = items.reduce((sum, item) => sum + item.productionCost, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.producedQuantity, 0);
  return {
    totalItems: items.length,
    totalValue: totalCost,
    averageValue: totalQuantity,
    period: 'Selected Period',
  };
};

export const calculatePackagingLossSummary = (items: PackagingLossReportItem[]) => {
  const totalProduced = items.reduce((sum, item) => sum + item.totalProduced, 0);
  const totalLoss = items.reduce((sum, item) => sum + item.packagingLoss, 0);
  const avgLossPercentage = totalProduced > 0 ? (totalLoss / totalProduced) * 100 : 0;
  return {
    totalProduced,
    totalLoss,
    avgLossPercentage: avgLossPercentage.toFixed(2),
  };
};

export const calculateSalesProfitSummary = (items: SalesProfitReportItem[]) => {
  const totalRevenue = items.reduce((sum, item) => sum + item.revenue, 0);
  const totalProfit = items.reduce((sum, item) => sum + item.profit, 0);
  const totalCost = items.reduce((sum, item) => sum + item.productionCost, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  return {
    totalRevenue,
    totalProfit,
    totalCost,
    avgMargin: avgMargin.toFixed(2),
    totalQuantity: items.reduce((sum, item) => sum + item.quantitySold, 0),
  };
};

export const filterByDateRange = <T extends { [key: string]: any }>(
  items: T[],
  dateField: keyof T,
  startDate: Date,
  endDate: Date
): T[] => {
  return items.filter(item => {
    const itemDate = new Date(item[dateField] as string);
    return itemDate >= startDate && itemDate <= endDate;
  });
};
