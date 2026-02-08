// Dashboard data utilities for Spices Management System

import { rawMaterials, getStockStatus } from './sampleData';
import { productionBatches } from './productionData';
import { packagingBatches } from './packagingData';
import { salesRecords, finishedProducts } from './salesData';

// Role types
export type UserRole = 'admin' | 'staff';

// Settings
export const SHOW_PROFIT_TO_STAFF = false;

// Dashboard metrics calculations
export const getLowStockCount = (): number => {
  return rawMaterials.filter(m => {
    const status = getStockStatus(m);
    return status === 'low' || status === 'out';
  }).length;
};

export const getOutOfStockCount = (): number => {
  return rawMaterials.filter(m => getStockStatus(m) === 'out').length;
};

export const getTodayProduction = (): { quantity: number; batches: number } => {
  const today = new Date().toDateString();
  const todayBatches = productionBatches.filter(
    b => new Date(b.productionDate).toDateString() === today && b.status === 'confirmed'
  );
  
  return {
    quantity: todayBatches.reduce((sum, b) => sum + b.finalOutputQuantity, 0),
    batches: todayBatches.length
  };
};

export const getTodayPackaging = (): { quantity: number; sessions: number } => {
  const today = new Date().toDateString();
  let totalQuantity = 0;
  let sessionCount = 0;
  
  packagingBatches.forEach(batch => {
    batch.sessions.forEach(session => {
      if (new Date(session.date).toDateString() === today) {
        totalQuantity += session.totalPackagedWeight;
        sessionCount++;
      }
    });
  });
  
  return { quantity: totalQuantity, sessions: sessionCount };
};

export const getTodaySales = (): { quantity: number; revenue: number; count: number } => {
  const today = new Date().toDateString();
  const todaySales = salesRecords.filter(
    s => new Date(s.saleDate).toDateString() === today
  );
  
  return {
    quantity: todaySales.reduce((sum, s) => sum + s.quantitySold, 0),
    revenue: todaySales.reduce((sum, s) => sum + s.totalAmount, 0),
    count: todaySales.length
  };
};

export const getPackagingLoss = (days: number = 30): number => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  let totalLoss = 0;
  packagingBatches.forEach(batch => {
    batch.sessions.forEach(session => {
      if (new Date(session.date) >= cutoffDate) {
        totalLoss += session.packagingLoss;
      }
    });
  });
  
  return totalLoss;
};

export const getProfitSnapshot = (days: number = 30): { profit: number; revenue: number; cost: number } => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const filteredSales = salesRecords.filter(s => new Date(s.saleDate) >= cutoffDate);
  
  const revenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const cost = filteredSales.reduce((sum, s) => sum + (s.productionCostPerUnit * s.quantitySold), 0);
  
  return {
    revenue,
    cost,
    profit: revenue - cost
  };
};

// Low stock items for alerts
export interface LowStockItem {
  id: string;
  name: string;
  availableStock: number;
  minimumStock: number;
  unit: 'kg' | 'gm';
  status: 'low' | 'critical';
}

export const getLowStockItems = (): LowStockItem[] => {
  return rawMaterials
    .filter(m => {
      const status = getStockStatus(m);
      return status === 'low' || status === 'out';
    })
    .map(m => ({
      id: m.id,
      name: m.name,
      availableStock: m.availableStock,
      minimumStock: m.minimumStock,
      unit: m.unit,
      status: m.availableStock === 0 ? 'critical' as const : 'low' as const
    }))
    .sort((a, b) => a.availableStock - b.availableStock);
};

// Recent activity types
export interface RecentProductionBatch {
  batchNumber: string;
  productName: string;
  quantity: number;
  date: string;
}

export interface RecentPackagingSession {
  batchNumber: string;
  productName: string;
  quantity: number;
  loss: number;
  date: string;
}

export interface RecentSale {
  productName: string;
  quantity: number;
  totalAmount: number;
  date: string;
}

export const getRecentProductionBatches = (limit: number = 5): RecentProductionBatch[] => {
  return productionBatches
    .filter(b => b.status === 'confirmed')
    .sort((a, b) => new Date(b.productionDate).getTime() - new Date(a.productionDate).getTime())
    .slice(0, limit)
    .map(b => ({
      batchNumber: b.batchNumber,
      productName: b.formulationName,
      quantity: b.finalOutputQuantity,
      date: b.productionDate
    }));
};

export const getRecentPackagingSessions = (limit: number = 5): RecentPackagingSession[] => {
  const sessions: RecentPackagingSession[] = [];
  
  packagingBatches.forEach(batch => {
    batch.sessions.forEach(session => {
      sessions.push({
        batchNumber: batch.batchNumber,
        productName: batch.productName,
        quantity: session.totalPackagedWeight,
        loss: session.packagingLoss,
        date: session.date
      });
    });
  });
  
  return sessions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
};

export const getRecentSales = (limit: number = 5): RecentSale[] => {
  return salesRecords
    .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
    .slice(0, limit)
    .map(s => ({
      productName: s.productName,
      quantity: s.quantitySold,
      totalAmount: s.totalAmount,
      date: s.saleDate
    }));
};

// Date range filter options
export type DateRangeOption = 'today' | 'week' | 'month' | 'custom';

export const getDateRangeLabel = (option: DateRangeOption): string => {
  switch (option) {
    case 'today': return 'Today';
    case 'week': return 'This Week';
    case 'month': return 'This Month';
    case 'custom': return 'Custom';
  }
};

export const getDateRangeStartDate = (option: DateRangeOption): Date => {
  const now = new Date();
  switch (option) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      return weekStart;
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'custom':
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
};
