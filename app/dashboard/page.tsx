'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Factory,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Boxes,
  Loader2,
  IndianRupee,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { LowStockAlerts } from '@/components/dashboard/LowStockAlerts';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';
import { formatCurrency } from '@/data/sampleData';

// Add this helper at the top of the file (after imports)
const formatLakh = (amount: number): string => {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)} L`;
  }
  return formatCurrency(amount);
};

// ✅ UPDATED: Added 'quarter' to DateRangeOption
export type DateRangeOption = 'today' | 'week' | 'month' | 'quarter' | 'all';

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
    clientName: string | null;
    quantity: number;
    totalAmount: number;
    date: string;
  }>;
  materialsCount: number;
  rawInventoryValue: number;
  labelInventoryValue: number;
  reports: {
    operationsTrend: Array<{
      date: string;
      label: string;
      salesRevenue: number;
      salesQuantity: number;
      profit: number;
      productionQuantity: number;
      packagingQuantity: number;
      packagingLoss: number;
    }>;
    productSales: Array<{
      name: string;
      value: number;
      quantity: number;
      fill: string;
    }>;
    paymentStatus: Array<{
      name: string;
      value: number;
      fill: string;
    }>;
    salesSummary: {
      revenue: number;
      quantity: number;
      orders: number;
      clients: number;
      averageOrderValue: number;
      received: number;
      outstanding: number;
    };
    topClients: Array<{
      name: string;
      value: number;
      quantity: number;
      orders: number;
    }>;
    salesByCity: Array<{
      name: string;
      value: number;
      quantity: number;
      fill: string;
    }>;
    salesBySalesman: Array<{
      name: string;
      value: number;
      quantity: number;
      fill: string;
    }>;
    salesCollection: Array<{
      name: string;
      value: number;
      fill: string;
    }>;
    inventoryValue: Array<{
      name: string;
      value: number;
      fill: string;
    }>;
  };
}

type PieReportItem = {
  name: string;
  value: number;
  fill: string;
  quantity?: number;
};

function EmptyReport({ message = 'No report data for this range' }: { message?: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed bg-muted/20 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function ReportTooltip({
  active,
  payload,
  label,
  valueType = 'auto',
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  valueType?: 'auto' | 'currency' | 'number';
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium">{label}</p>}
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-medium">
              {valueType === 'currency' ||
                (valueType === 'auto' &&
                  ['revenue', 'profit', 'amount', 'received', 'outstanding'].some((term) =>
                    item.name?.toLowerCase().includes(term),
                  ))
                ? formatCurrency(item.value ?? 0)
                : (item.value ?? 0).toLocaleString('en-IN')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PieReportCard({
  title,
  description,
  data,
  valueLabel = 'Value',
}: {
  title: string;
  description: string;
  data: PieReportItem[];
  valueLabel?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 || total <= 0 ? (
          <EmptyReport />
        ) : (
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<ReportTooltip valueType={valueLabel === 'Amount' ? 'currency' : 'number'} />} />
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={76}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {data.map((item) => (
                      <Cell key={item.name} fill={item.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center gap-2">
              {data.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.fill }} />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="shrink-0 font-medium">
                    {valueLabel === 'Amount' ? formatCurrency(item.value) : item.value.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SalesReportMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-2xl font-bold">{value}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRangeOption>('all');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
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
  }, [dateRange]);

  // Fetch data on mount and when date range changes
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ✅ UPDATED: Helper function to get date range label
  const getDateRangeLabel = () => {
    switch (dateRange) {
      case 'today':
        return 'Today';
      case 'week':
        return 'This week';
      case 'month':
        return 'This month';
      case 'quarter':
        return 'This quarter';
      case 'all':
        return 'All time';
      default:
        return 'Period';
    }
  };

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
            <DateRangeFilter value={dateRange} onChange={(value) => setDateRange(value as DateRangeOption)} />
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Packaging Loss"
            value={`${dashboardData.packagingLoss.toFixed(2)} kg`}
            subtitle={getDateRangeLabel()} // ✅ UPDATED: Uses helper function
            icon={TrendingDown}
            variant={dashboardData.packagingLoss > 5 ? 'danger' : 'default'}
            href="/packaging"
          />
          <MetricCard
            title="Net"
            value={formatCurrency(dashboardData.profitSnapshot.profit)}
            subtitle={`Revenue: ${formatCurrency(dashboardData.profitSnapshot.revenue)}`}
            icon={TrendingUp}
            variant={dashboardData.profitSnapshot.profit > 0 ? 'success' : 'danger'}
            href="/sales"
          />
          <MetricCard
            title="Raw Inventory Value"
            value={formatLakh(dashboardData.rawInventoryValue ?? 0)}
            subtitle="Cost × stock across all materials"
            icon={Boxes}
            variant="success"
            href="/inventory"
          />
          <MetricCard
            title="Label Inventory Value"
            value={formatLakh(dashboardData.labelInventoryValue ?? 0)}
            subtitle="Stock × cost per unit"
            icon={IndianRupee}
            variant="default"
            href="/labels/inventory"
          />
        </div>

        {/* REPORTS */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Reports</h2>
            <p className="text-sm text-muted-foreground">
              Visual summary for {getDateRangeLabel().toLowerCase()}
            </p>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Operations Trend</CardTitle>
              <CardDescription>Revenue, production, packaging, and profit by day</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData.reports.operationsTrend.length === 0 ? (
                <EmptyReport />
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dashboardData.reports.operationsTrend} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis
                        yAxisId="amount"
                        tickLine={false}
                        axisLine={false}
                        width={72}
                        tickFormatter={(value) => `₹${Number(value) / 1000}k`}
                      />
                      <YAxis
                        yAxisId="quantity"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        width={44}
                      />
                      <Tooltip content={<ReportTooltip />} />
                      <Legend />
                      <Bar
                        yAxisId="amount"
                        dataKey="salesRevenue"
                        name="Revenue"
                        fill="#8b4a32"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="amount"
                        type="monotone"
                        dataKey="profit"
                        name="Profit"
                        stroke="#16a34a"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="quantity"
                        type="monotone"
                        dataKey="productionQuantity"
                        name="Production kg"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="quantity"
                        type="monotone"
                        dataKey="packagingQuantity"
                        name="Packaging kg"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Sales Reports</h3>
              <p className="text-sm text-muted-foreground">
                Client, collection, city, and salesman breakdown
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
              <SalesReportMetric
                label="Sales Amount"
                value={formatCurrency(dashboardData.reports.salesSummary.revenue)}
                detail={`${dashboardData.reports.salesSummary.quantity.toLocaleString('en-IN')} units`}
              />
              <SalesReportMetric
                label="Client Records"
                value={dashboardData.reports.salesSummary.orders.toLocaleString('en-IN')}
                detail={`${dashboardData.reports.salesSummary.clients.toLocaleString('en-IN')} clients`}
              />
              <SalesReportMetric
                label="Average Order"
                value={formatCurrency(dashboardData.reports.salesSummary.averageOrderValue)}
                detail="Per client record"
              />
              <SalesReportMetric
                label="Received"
                value={formatCurrency(dashboardData.reports.salesSummary.received)}
                detail="Amount collected"
              />
              <SalesReportMetric
                label="Outstanding"
                value={formatCurrency(dashboardData.reports.salesSummary.outstanding)}
                detail="Pending collection"
              />
              <SalesReportMetric
                label="Clients"
                value={dashboardData.reports.salesSummary.clients.toLocaleString('en-IN')}
                detail="Unique clients"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Top Clients</CardTitle>
                  <CardDescription>Highest sales amount by client</CardDescription>
                </CardHeader>
                <CardContent>
                  {dashboardData.reports.topClients.length === 0 ? (
                    <EmptyReport />
                  ) : (
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={dashboardData.reports.topClients}
                          layout="vertical"
                          margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis
                            type="number"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `₹${Number(value) / 1000}k`}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={130}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip content={<ReportTooltip valueType="currency" />} />
                          <Bar dataKey="value" name="Revenue" fill="#8b4a32" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <PieReportCard
                title="Collection"
                description="Received vs outstanding amount"
                data={dashboardData.reports.salesCollection}
                valueLabel="Amount"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <PieReportCard
              title="Sales By Product"
              description="Top products by sales amount"
              data={dashboardData.reports.productSales}
              valueLabel="Amount"
            />
            <PieReportCard
              title="Payment Status"
              description="Paid, partial, and unpaid sales amount"
              data={dashboardData.reports.paymentStatus}
              valueLabel="Amount"
            />
            <PieReportCard
              title="Sales By City"
              description="Sales amount by client city"
              data={dashboardData.reports.salesByCity}
              valueLabel="Amount"
            />
            <PieReportCard
              title="Sales By Salesman"
              description="Sales amount by assigned salesman"
              data={dashboardData.reports.salesBySalesman}
              valueLabel="Amount"
            />
            <PieReportCard
              title="Inventory Value"
              description="Value split by inventory type"
              data={dashboardData.reports.inventoryValue}
              valueLabel="Amount"
            />
          </div>
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
