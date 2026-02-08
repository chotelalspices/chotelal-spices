import { productionBatches } from "./productionData";

export interface ContainerSize {
  id: string;
  size: number; // in grams
  label: string;
}

export interface PackagedItem {
  containerId: string;
  containerSize: number; // grams
  containerLabel: string;
  numberOfPackets: number;
  totalWeight: number; // in kg
}

export interface PackagingSession {
  id: string;
  batchNumber: string;
  date: string;
  items: PackagedItem[];
  packagingLoss: number; // in kg
  totalPackagedWeight: number; // in kg
  remarks?: string;
  performedBy: string;
}

export interface PackagingBatch {
  batchNumber: string;
  productName: string;
  producedQuantity: number; // kg
  alreadyPackaged: number; // kg
  totalLoss: number; // kg
  remainingQuantity: number; // kg
  status: "Not Started" | "Partial" | "Completed";
  sessions: PackagingSession[];
}

export const containerSizes: ContainerSize[] = [
  { id: "10g", size: 10, label: "10g" },
  { id: "25g", size: 25, label: "25g" },
  { id: "50g", size: 50, label: "50g" },
  { id: "100g", size: 100, label: "100g" },
  { id: "200g", size: 200, label: "200g" },
  { id: "250g", size: 250, label: "250g" },
  { id: "500g", size: 500, label: "500g" },
  { id: "1kg", size: 1000, label: "1 kg" },
];

// Sample packaging data based on production batches
export const packagingBatches: PackagingBatch[] = [
  {
    batchNumber: "BATCH-2024-001",
    productName: "Garam Masala",
    producedQuantity: 95.0,
    alreadyPackaged: 60.0,
    totalLoss: 0.5,
    remainingQuantity: 34.5,
    status: "Partial",
    sessions: [
      {
        id: "PKG-001",
        batchNumber: "BATCH-2024-001",
        date: "2024-01-16",
        items: [
          { containerId: "100g", containerSize: 100, containerLabel: "100g", numberOfPackets: 300, totalWeight: 30.0 },
          { containerId: "200g", containerSize: 200, containerLabel: "200g", numberOfPackets: 150, totalWeight: 30.0 },
        ],
        packagingLoss: 0.5,
        totalPackagedWeight: 60.0,
        remarks: "First packaging session",
        performedBy: "Ravi Kumar",
      },
    ],
  },
  {
    batchNumber: "BATCH-2024-002",
    productName: "Chaat Masala",
    producedQuantity: 47.5,
    alreadyPackaged: 47.0,
    totalLoss: 0.3,
    remainingQuantity: 0.2,
    status: "Completed",
    sessions: [
      {
        id: "PKG-002",
        batchNumber: "BATCH-2024-002",
        date: "2024-01-17",
        items: [
          { containerId: "50g", containerSize: 50, containerLabel: "50g", numberOfPackets: 500, totalWeight: 25.0 },
          { containerId: "100g", containerSize: 100, containerLabel: "100g", numberOfPackets: 220, totalWeight: 22.0 },
        ],
        packagingLoss: 0.3,
        totalPackagedWeight: 47.0,
        remarks: "Complete packaging",
        performedBy: "Amit Sharma",
      },
    ],
  },
  {
    batchNumber: "BATCH-2024-003",
    productName: "Sambhar Masala",
    producedQuantity: 142.5,
    alreadyPackaged: 0,
    totalLoss: 0,
    remainingQuantity: 142.5,
    status: "Not Started",
    sessions: [],
  },
  {
    batchNumber: "BATCH-2024-004",
    productName: "Turmeric Powder Blend",
    producedQuantity: 190.0,
    alreadyPackaged: 100.0,
    totalLoss: 0.8,
    remainingQuantity: 89.2,
    status: "Partial",
    sessions: [
      {
        id: "PKG-003",
        batchNumber: "BATCH-2024-004",
        date: "2024-01-18",
        items: [
          { containerId: "250g", containerSize: 250, containerLabel: "250g", numberOfPackets: 200, totalWeight: 50.0 },
          { containerId: "500g", containerSize: 500, containerLabel: "500g", numberOfPackets: 100, totalWeight: 50.0 },
        ],
        packagingLoss: 0.8,
        totalPackagedWeight: 100.0,
        remarks: "Bulk packaging for wholesale",
        performedBy: "Ravi Kumar",
      },
    ],
  },
];

export const getPackagingBatchByNumber = (batchNumber: string): PackagingBatch | undefined => {
  return packagingBatches.find((batch) => batch.batchNumber === batchNumber);
};

export const calculatePackagedWeight = (items: PackagedItem[]): number => {
  return items.reduce((total, item) => total + item.totalWeight, 0);
};

export const calculateItemWeight = (containerSize: number, numberOfPackets: number): number => {
  // Convert grams to kg
  return (containerSize * numberOfPackets) / 1000;
};

export const validatePackagingEntry = (
  remainingQuantity: number,
  items: PackagedItem[],
  packagingLoss: number
): { valid: boolean; message: string } => {
  const totalWeight = calculatePackagedWeight(items) + packagingLoss;
  
  if (totalWeight > remainingQuantity) {
    return {
      valid: false,
      message: `Total packaged weight (${totalWeight.toFixed(2)} kg) + loss exceeds remaining quantity (${remainingQuantity.toFixed(2)} kg)`,
    };
  }
  
  if (items.length === 0) {
    return {
      valid: false,
      message: "At least one container size must be added",
    };
  }
  
  return { valid: true, message: "" };
};

export const generateSessionId = (): string => {
  const timestamp = Date.now();
  return `PKG-${timestamp}`;
};

export const getStatusColor = (status: PackagingBatch["status"]): string => {
  switch (status) {
    case "Not Started":
      return "bg-muted text-muted-foreground";
    case "Partial":
      return "bg-muted text-primary";
    case "Completed":
      return "bg-muted text-success";
    default:
      return "bg-muted text-muted-foreground";
  }
};
