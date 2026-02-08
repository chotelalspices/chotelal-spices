'use client';

import { 
  Factory, 
  Package, 
  ShoppingCart, 
  ChevronRight 
} from 'lucide-react';
import { cn } from '@/libs/utils';
import { 
  RecentProductionBatch, 
  RecentPackagingSession, 
  RecentSale,
  SHOW_PROFIT_TO_STAFF
} from '@/data/dashboardData';
import { formatDate, formatCurrency } from '@/data/sampleData';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

interface RecentActivityProps {
  productionBatches: RecentProductionBatch[];
  packagingSessions: RecentPackagingSession[];
  sales: RecentSale[];
  className?: string;
}

export function RecentActivity({ 
  productionBatches, 
  packagingSessions, 
  sales,
  className 
}: RecentActivityProps) {
  const router = useRouter();
  const showProfit = SHOW_PROFIT_TO_STAFF;

  return (
    <div className={cn('industrial-card p-4 md:p-6', className)}>
      <Tabs defaultValue="production" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title mb-0">Recent Activity</h3>
          <TabsList className="hidden md:flex">
            <TabsTrigger value="production" className="gap-1">
              <Factory className="h-4 w-4" />
              Production
            </TabsTrigger>
            <TabsTrigger value="packaging" className="gap-1">
              <Package className="h-4 w-4" />
              Packaging
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-1">
              <ShoppingCart className="h-4 w-4" />
              Sales
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Mobile tabs */}
        <TabsList className="w-full mb-4 md:hidden">
          <TabsTrigger value="production" className="flex-1">Production</TabsTrigger>
          <TabsTrigger value="packaging" className="flex-1">Packaging</TabsTrigger>
          <TabsTrigger value="sales" className="flex-1">Sales</TabsTrigger>
        </TabsList>

        {/* PRODUCTION */}
        <TabsContent value="production" className="mt-0">
          <div className="space-y-2">
            {productionBatches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent production</p>
            ) : (
              productionBatches.map((batch) => (
                <div
                  key={batch.batchNumber}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => router.push('/production')}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{batch.productName}</p>
                    <p className="text-xs text-muted-foreground">{batch.batchNumber}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <Badge variant="secondary">{batch.quantity} kg</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(batch.date)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-3"
            onClick={() => router.push('/production')}
          >
            View All Production <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </TabsContent>

        {/* PACKAGING */}
        <TabsContent value="packaging" className="mt-0">
          <div className="space-y-2">
            {packagingSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent packaging</p>
            ) : (
              packagingSessions.map((session, index) => (
                <div
                  key={`${session.batchNumber}-${index}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => router.push('/packaging')}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{session.productName}</p>
                    <p className="text-xs text-muted-foreground">{session.batchNumber}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <Badge variant="secondary">{session.quantity} kg</Badge>
                    {session.loss > 0 && (
                      <Badge variant="outline" className="ml-1 text-destructive border-destructive/50">
                        -{session.loss} kg
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(session.date)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-3"
            onClick={() => router.push('/packaging')}
          >
            View All Packaging <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </TabsContent>

        {/* SALES */}
        <TabsContent value="sales" className="mt-0">
          <div className="space-y-2">
            {sales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent sales</p>
            ) : (
              sales.map((sale, index) => (
                <div
                  key={`${sale.productName}-${index}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => router.push('/sales')}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{sale.productName}</p>
                    <p className="text-xs text-muted-foreground">{sale.quantity} units</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    {showProfit && (
                      <Badge variant="secondary">{formatCurrency(sale.totalAmount)}</Badge>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(sale.date)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-3"
            onClick={() => router.push('/sales')}
          >
            View All Sales <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
