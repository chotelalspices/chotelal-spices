import { productionBatches, formatCurrency, formatQuantity } from './productionData';
import { formulations } from './formulationData';

export interface FinishedProduct {
  id: string;
  name: string;
  formulationId: string;
  batchId?: string;
  batchNumber?: string;
  availableInventory: number;
  unit: 'kg' | 'gm';
  productionCostPerKg: number;
  createdAt: string;
}

export interface SalesRecord {
  id: string;
  productId: string;
  productName: string;
  batchId?: string;
  batchNumber?: string;
  clientName?: string;
  voucherNo?: string;
  voucherType?: string;
  quantitySold: number;
  unit: 'kg' | 'gm';
  sellingPricePerUnit: number;
  totalAmount: number;
  productionCostPerUnit: number;
  profit: number;
  discount: number;
  saleDate: string;
  remarks?: string;
  createdBy: string;
  createdAt: string;
}

export interface ExcelUploadRow {
  rowNumber: number;
  siNo: number;
  id: string;
  productName: string;
  numberOfPackets: number;
  productionCost: number;
  sellingPricePerPacket: number;
  discount: number;
  finalAmount: number;
  availableQuantity: number;
  profitLoss: number;
  isFree: boolean;
  status?: 'valid' | 'invalid';
  errors?: string[];
  // Original Excel data for reference
  descriptionOfGoods: string | null;
  hsnSac: string | null;
  gstRate: string | null;
  mrpMarginal: string | null;
  case: string | null;
  quantity: string | null;
  rate: string | null;
  per: string | null;
  discPercent: string | null;
  amount: string | null;
}

// Sample finished products (from confirmed production batches)
export const finishedProducts: FinishedProduct[] = [
  {
    id: 'fp-1',
    name: 'Garam Masala 100g',
    formulationId: '1',
    batchId: '1',
    batchNumber: 'BATCH-2024-001',
    availableInventory: 35,
    unit: 'kg',
    productionCostPerKg: 255.10,
    createdAt: '2024-12-20T14:30:00Z',
  },
  {
    id: 'fp-2',
    name: 'Garam Masala 200g',
    formulationId: '1',
    batchId: '1',
    batchNumber: 'BATCH-2024-001',
    availableInventory: 14,
    unit: 'kg',
    productionCostPerKg: 255.10,
    createdAt: '2024-12-20T14:30:00Z',
  },
  {
    id: 'fp-3',
    name: 'Chaat Masala 100g',
    formulationId: '2',
    batchId: '2',
    batchNumber: 'BATCH-2024-002',
    availableInventory: 18.5,
    unit: 'kg',
    productionCostPerKg: 180.75,
    createdAt: '2024-12-20T14:30:00Z',
  },
  {
    id: 'fp-4',
    name: 'Chaat Masala 200g',
    formulationId: '2',
    batchId: '2',
    batchNumber: 'BATCH-2024-002',
    availableInventory: 8,
    unit: 'kg',
    productionCostPerKg: 180.75,
    createdAt: '2024-12-20T14:30:00Z',
  },
  {
    id: 'fp-5',
    name: 'Turmeric Powder 100g',
    formulationId: '3',
    batchId: '3',
    batchNumber: 'BATCH-2024-003',
    availableInventory: 12,
    unit: 'kg',
    productionCostPerKg: 145.50,
    createdAt: '2024-12-20T14:30:00Z',
  },
  {
    id: 'fp-6',
    name: 'Turmeric Powder 200g',
    formulationId: '3',
    batchId: '3',
    batchNumber: 'BATCH-2024-003',
    availableInventory: 6,
    unit: 'kg',
    productionCostPerKg: 145.50,
    createdAt: '2024-12-20T14:30:00Z',
  },
];

// Sample sales records
export const salesRecords: SalesRecord[] = [
  {
    id: 'sale-1',
    productId: 'fp-1',
    productName: 'Garam Masala 100g',
    batchId: '1',
    batchNumber: 'BATCH-2024-001',
    quantitySold: 10,
    unit: 'kg',
    sellingPricePerUnit: 380,
    totalAmount: 3800,
    productionCostPerUnit: 255.10,
    profit: 1249,
    discount: 0,
    saleDate: '2024-12-21',
    createdBy: 'Rajesh Singh',
    createdAt: '2024-12-21T10:30:00Z',
  },
  {
    id: 'sale-2',
    productId: 'fp-3',
    productName: 'Chaat Masala 100g',
    batchId: '2',
    batchNumber: 'BATCH-2024-002',
    quantitySold: 5,
    unit: 'kg',
    sellingPricePerUnit: 280,
    totalAmount: 1400,
    productionCostPerUnit: 170.56,
    profit: 547.20,
    discount: 0,
    saleDate: '2024-12-23',
    remarks: 'Bulk order for local retailer',
    createdBy: 'Suresh Patel',
    createdAt: '2024-12-23T14:15:00Z',
  },
  {
    id: 'sale-3',
    productId: 'fp-5',
    productName: 'Sambhar Masala 200g',
    batchId: '3',
    batchNumber: 'BATCH-2024-003',
    quantitySold: 20,
    unit: 'kg',
    sellingPricePerUnit: 260,
    totalAmount: 5200,
    productionCostPerUnit: 162.05,
    profit: 1959,
    discount: 0,
    saleDate: '2024-12-26',
    createdBy: 'Rajesh Singh',
    createdAt: '2024-12-26T09:00:00Z',
  },
  {
    id: 'sale-4',
    productId: 'fp-2',
    productName: 'Garam Masala 200g',
    batchId: '1',
    batchNumber: 'BATCH-2024-001',
    quantitySold: 8,
    unit: 'kg',
    sellingPricePerUnit: 370,
    totalAmount: 2960,
    productionCostPerUnit: 255.10,
    profit: 919.20,
    discount: 0,
    saleDate: '2024-12-27',
    remarks: 'Premium packaging order',
    createdBy: 'Suresh Patel',
    createdAt: '2024-12-27T11:30:00Z',
  },
  {
    id: 'sale-5',
    productId: 'fp-6',
    productName: 'Sambhar Masala 500g',
    batchId: '3',
    batchNumber: 'BATCH-2024-003',
    quantitySold: 15,
    unit: 'kg',
    sellingPricePerUnit: 250,
    totalAmount: 3750,
    productionCostPerUnit: 162.05,
    profit: 1319.25,
    discount: 0,
    saleDate: '2024-12-27',
    createdBy: 'Rajesh Singh',
    createdAt: '2024-12-27T16:45:00Z',
  },
];

// Calculate profit for a sale
export const calculateProfit = (
  quantitySold: number,
  sellingPricePerUnit: number,
  productionCostPerUnit: number
): number => {
  const totalRevenue = quantitySold * sellingPricePerUnit;
  const totalCost = quantitySold * productionCostPerUnit;
  return totalRevenue - totalCost;
};

// Get available finished products
export const getAvailableProducts = (): FinishedProduct[] => {
  return finishedProducts.filter(fp => fp.availableInventory > 0);
};

// Get product by ID
export const getProductById = (id: string): FinishedProduct | undefined => {
  return finishedProducts.find(fp => fp.id === id);
};

// Calculate sales summary
export const calculateSalesSummary = (records: SalesRecord[]): {
  totalRevenue: number;
  totalProfit: number;
  totalQuantity: number;
  salesCount: number;
} => {
  return records.reduce(
    (acc, record) => ({
      totalRevenue: acc.totalRevenue + record.totalAmount,
      totalProfit: acc.totalProfit + record.profit,
      totalQuantity: acc.totalQuantity + record.quantitySold,
      salesCount: acc.salesCount + 1,
    }),
    { totalRevenue: 0, totalProfit: 0, totalQuantity: 0, salesCount: 0 }
  );
};

// Validate Excel upload row
export const validateExcelRow = (
  row: Partial<ExcelUploadRow>,
  rowNumber: number,
  finishedProducts?: any[]
): ExcelUploadRow => {
  const errors: string[] = [];

  // Find matching product
  const product = finishedProducts?.find(
    fp => fp.name.toLowerCase() === row.descriptionOfGoods?.toLowerCase()
  );

  if (!product) {
    errors.push('Product not found in finished products');
  }

  // Parse quantity from Excel
  const quantity = row.quantity ? parseFloat(row.quantity.toString()) : 0;
  if (!row.quantity || quantity <= 0) {
    errors.push('Invalid quantity');
  }

  // Parse rate from Excel
  const rate = row.rate ? parseFloat(row.rate.toString()) : 0;
  
  // Parse amount from Excel
  const amount = row.amount ? parseFloat(row.amount.toString()) : 0;
  
  // Calculate final amount to determine if it's free
  const discount = row.discPercent ? parseFloat(row.discPercent.toString()) : 0;
  const totalAmount = rate * quantity;
  const finalAmount = totalAmount - (totalAmount * discount / 100);
  const isFree = finalAmount === 0;
  
  // Only validate rate and amount if not free
  if (!isFree) {
    if (!row.rate || rate <= 0) {
      errors.push('Invalid rate');
    }
    
    if (!row.amount || amount <= 0) {
      errors.push('Invalid amount');
    }
  }

  // Check stock availability
  if (product && quantity > product.availableQuantity) {
    errors.push(`Insufficient stock. Available: ${product.availableQuantity} ${product.unit}`);
  }

  // Calculate values
  const productionCost = product ? (product.productionCostPerPacket * quantity) : 0;
  const profitLoss = isFree ? 0 : finalAmount - productionCost;

  return {
    rowNumber,
    siNo: row.siNo || 0,
    id: product?.id || '',
    productName: product?.name || row.descriptionOfGoods || '',
    numberOfPackets: quantity,
    productionCost,
    sellingPricePerPacket: rate,
    discount,
    finalAmount,
    availableQuantity: product?.availableQuantity || 0,
    profitLoss,
    isFree,
    status: errors.length > 0 ? 'invalid' : 'valid',
    errors: errors.length > 0 ? errors : undefined,
    // Original Excel data
    descriptionOfGoods: row.descriptionOfGoods || null,
    hsnSac: row.hsnSac || null,
    gstRate: row.gstRate || null,
    mrpMarginal: row.mrpMarginal || null,
    case: row.case || null,
    quantity: row.quantity || null,
    rate: row.rate || null,
    per: row.per || null,
    discPercent: row.discPercent || null,
    amount: row.amount || null,
  };
};

// Format date for display
export const formatSaleDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export { formatCurrency, formatQuantity };
