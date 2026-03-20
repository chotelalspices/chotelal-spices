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
  city?: string;           // ← new
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
  paymentStatus?: 'paid' | 'unpaid' | 'partial';
  amountPaid?: number;
  amountDue?: number;
  paymentNote?: string;
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

export const salesRecords: SalesRecord[] = [];

export const calculateProfit = (
  quantitySold: number,
  sellingPricePerUnit: number,
  productionCostPerUnit: number
): number => {
  return quantitySold * sellingPricePerUnit - quantitySold * productionCostPerUnit;
};

export const getAvailableProducts = (): FinishedProduct[] =>
  finishedProducts.filter((fp) => fp.availableInventory > 0);

export const getProductById = (id: string): FinishedProduct | undefined =>
  finishedProducts.find((fp) => fp.id === id);

export const calculateSalesSummary = (
  records: SalesRecord[]
): { totalRevenue: number; totalProfit: number; totalQuantity: number; salesCount: number } =>
  records.reduce(
    (acc, record) => ({
      totalRevenue: acc.totalRevenue + record.totalAmount,
      totalProfit: acc.totalProfit + record.profit,
      totalQuantity: acc.totalQuantity + record.quantitySold,
      salesCount: acc.salesCount + 1,
    }),
    { totalRevenue: 0, totalProfit: 0, totalQuantity: 0, salesCount: 0 }
  );

export const validateExcelRow = (
  row: Partial<ExcelUploadRow>,
  rowNumber: number,
  finishedProducts?: any[]
): ExcelUploadRow => {
  const errors: string[] = [];
  const product = finishedProducts?.find(
    (fp) => fp.name.toLowerCase() === row.descriptionOfGoods?.toLowerCase()
  );
  if (!product) errors.push('Product not found in finished products');
  const quantity = row.quantity ? parseFloat(row.quantity.toString()) : 0;
  if (!row.quantity || quantity <= 0) errors.push('Invalid quantity');
  const rate = row.rate ? parseFloat(row.rate.toString()) : 0;
  const amount = row.amount ? parseFloat(row.amount.toString()) : 0;
  const discount = row.discPercent ? parseFloat(row.discPercent.toString()) : 0;
  const totalAmount = rate * quantity;
  const finalAmount = totalAmount - (totalAmount * discount) / 100;
  const isFree = finalAmount === 0;
  if (!isFree) {
    if (!row.rate || rate <= 0) errors.push('Invalid rate');
    if (!row.amount || amount <= 0) errors.push('Invalid amount');
  }
  if (product && quantity > product.availableQuantity)
    errors.push(`Insufficient stock. Available: ${product.availableQuantity} ${product.unit}`);
  const productionCost = product ? product.productionCostPerPacket * quantity : 0;
  const profitLoss = isFree ? 0 : finalAmount - productionCost;
  return {
    rowNumber, siNo: row.siNo || 0, id: product?.id || '',
    productName: product?.name || row.descriptionOfGoods || '',
    numberOfPackets: quantity, productionCost,
    sellingPricePerPacket: rate, discount, finalAmount,
    availableQuantity: product?.availableQuantity || 0,
    profitLoss, isFree,
    status: errors.length > 0 ? 'invalid' : 'valid',
    errors: errors.length > 0 ? errors : undefined,
    descriptionOfGoods: row.descriptionOfGoods || null,
    hsnSac: row.hsnSac || null, gstRate: row.gstRate || null,
    mrpMarginal: row.mrpMarginal || null, case: row.case || null,
    quantity: row.quantity || null, rate: row.rate || null,
    per: row.per || null, discPercent: row.discPercent || null,
    amount: row.amount || null,
  };
};

export const formatSaleDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

export { formatCurrency, formatQuantity };