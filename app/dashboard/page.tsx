'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Factory,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Boxes,
  Loader2,
} from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { LowStockAlerts } from '@/components/dashboard/LowStockAlerts';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { formatCurrency } from '@/data/sampleData';

import { DateRangeOption } from '@/data/dashboardData';

// Types for dashboard data
interface DashboardData {
  lowStockCount: number;
  outOfStockCount: number;
  todayProduction: { quantity: number; batches: number };
  todayPackaging: { quantity: number; sessions: number };
  todaySales: { quantity: number; revenue: number; count: number };
  packagingLoss: number;
  profitSnapshot: { profit: number; revenue: number; cost: number };
  lowStockItems: Array<{
    id: string;
    name: string;
    availableStock: number;
    minimumStock: number;
    unit: 'kg' | 'gm';
    status: 'low' | 'critical';
  }>;
  recentProduction: Array<{
    batchNumber: string;
    productName: string;
    quantity: number;
    date: string;
  }>;
  recentPackaging: Array<{
    batchNumber: string;
    productName: string;
    quantity: number;
    loss: number;
    date: string;
  }>;
  recentSales: Array<{
    productName: string;
    quantity: number;
    totalAmount: number;
    date: string;
  }>;
  materialsCount: number;
}

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRangeOption>('month');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/dashboard?dateRange=${dateRange}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on mount and when date range changes
  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  // Show loading state
  if (loading && !dashboardData) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading dashboard...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Show error state
  if (error && !dashboardData) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading dashboard: {error}</p>
            <button
              onClick={fetchDashboardData}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Guard against no data
  if (!dashboardData) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-96">
          <p>No dashboard data available</p>
        </div>
      </AppLayout>
    );
  }


  return (
    <AppLayout>
      <div className="space-y-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Factory operations at a glance
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
          </div>
        </div>

        {/* PRIMARY KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Low Stock"
            value={dashboardData.lowStockCount}
            subtitle={dashboardData.outOfStockCount > 0 ? `${dashboardData.outOfStockCount} out of stock` : undefined}
            icon={AlertTriangle}
            variant={dashboardData.lowStockCount > 0 ? 'warning' : 'default'}
            href="/"
          />
          <MetricCard
            title="Production Today"
            value={`${dashboardData.todayProduction.quantity} kg`}
            subtitle={`${dashboardData.todayProduction.batches} batches`}
            icon={Factory}
            variant="primary"
            href="/production"
          />
          <MetricCard
            title="Packaging Today"
            value={`${dashboardData.todayPackaging.quantity} kg`}
            subtitle={`${dashboardData.todayPackaging.sessions} sessions`}
            icon={Package}
            variant="primary"
            href="/packaging"
          />
          <MetricCard
            title="Sales Today"
            value={formatCurrency(dashboardData.todaySales.revenue)}
            subtitle={`${dashboardData.todaySales.quantity} units`}
            icon={ShoppingCart}
            variant="success"
            href="/sales"
          />
        </div>

        {/* ADMIN METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard
            title="Packaging Loss"
            value={`${dashboardData.packagingLoss.toFixed(2)} kg`}
            subtitle={dateRange === 'today' ? 'Today' : dateRange === 'week' ? 'This week' : 'This month'}
            icon={TrendingDown}
            variant={dashboardData.packagingLoss > 5 ? 'danger' : 'default'}
            href="/packaging"
          />
          <MetricCard
            title="Profit"
            value={formatCurrency(dashboardData.profitSnapshot.profit)}
            subtitle={`Revenue: ${formatCurrency(dashboardData.profitSnapshot.revenue)}`}
            icon={TrendingUp}
            variant={dashboardData.profitSnapshot.profit > 0 ? 'success' : 'danger'}
            href="/sales"
          />
          <MetricCard
            title="Materials"
            value={dashboardData.materialsCount.toString()}
            subtitle="Active items"
            icon={Boxes}
            variant="default"
            href="/"
          />
        </div>

        {/* QUICK ACTIONS */}
        <div className="pt-2">
          <QuickActions />
        </div>

        {/* INSIGHTS */}
        <div className="grid lg:grid-cols-2 gap-6">
          <LowStockAlerts items={dashboardData.lowStockItems} />
          <RecentActivity
            productionBatches={dashboardData.recentProduction}
            packagingSessions={dashboardData.recentPackaging}
            sales={dashboardData.recentSales}
          />
        </div>
      </div>
    </AppLayout>
  );
}
