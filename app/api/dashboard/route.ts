export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to perform this action." },
        { status: 401 }
      );
    }

    // Get the authenticated user's ID
    const authenticatedUserId = (session.user as any).id as string;

    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: "User ID not found in session." },
        { status: 401 }
      );
    }

    // Verify the user exists and is active in the database
    const user = await prisma.user.findUnique({
      where: { id: authenticatedUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found in database." },
        { status: 401 }
      );
    }

    if (user.status !== "active") {
      return NextResponse.json(
        {
          error:
            "Your account is not active. Please contact an administrator.",
        },
        { status: 403 }
      );
    }

    // Get query parameters for date filtering
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || 'month';
    
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        startDate = weekStart;
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    // Get today's date for today-specific metrics
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Fetch raw materials with stock calculations
    const rawMaterials = await prisma.rawMaterial.findMany({
      include: {
        stockMovements: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // Calculate stock levels
    const materialsWithStock = rawMaterials.map((material) => {
      const availableStock = material.stockMovements.reduce((total, movement) => {
        if (movement.action === 'add') {
          return total + movement.quantity;
        } else {
          return total - movement.quantity;
        }
      }, 0);

      return {
        ...material,
        availableStock,
      };
    });

    // Calculate low stock metrics
    const lowStockItems = materialsWithStock.filter(m => 
      m.availableStock > 0 && m.availableStock <= m.minimumStock
    );
    const outOfStockItems = materialsWithStock.filter(m => m.availableStock <= 0);

    // Fetch today's production batches
    const todayProductionBatches = await prisma.productionBatch.findMany({
      where: {
        productionDate: {
          gte: todayStart,
          lt: todayEnd,
        },
        status: {
          in: ['confirmed', 'ready_for_packaging'],
        },
      },
      include: {
        formulation: true,
      },
    });

    const todayProduction = {
      quantity: todayProductionBatches.reduce((sum, batch) => sum + (batch.finalOutput || batch.plannedQuantity), 0),
      batches: todayProductionBatches.length,
    };

    // Fetch packaging sessions for today
    const todayPackagingSessions = await prisma.packagingSession.findMany({
      where: {
        date: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
      include: {
        items: true,
        batch: {
          include: {
            formulation: true,
          },
        },
      },
    });

    const todayPackaging = {
      quantity: todayPackagingSessions.reduce((sum, session) => 
        sum + session.items.reduce((itemSum, item) => itemSum + item.totalWeight, 0), 0),
      sessions: todayPackagingSessions.length,
    };

    // Fetch today's sales records
    const todaySalesRecords = await prisma.salesRecord.findMany({
      where: {
        saleDate: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
      include: {
        product: true,
      },
    });

    const todaySales = {
      quantity: todaySalesRecords.reduce((sum, sale) => sum + sale.quantitySold, 0),
      revenue: todaySalesRecords.reduce((sum, sale) => sum + (sale.quantitySold * sale.sellingPrice), 0),
      count: todaySalesRecords.length,
    };

    // Calculate packaging loss for the date range
    const packagingSessionsInRange = await prisma.packagingSession.findMany({
      where: {
        date: {
          gte: startDate,
        },
      },
      include: {
        items: true,
      },
    });

    const packagingLoss = packagingSessionsInRange.reduce((sum, session) => sum + session.packagingLoss, 0);

    // Calculate profit snapshot for the date range
    const salesRecordsInRange = await prisma.salesRecord.findMany({
      where: {
        saleDate: {
          gte: startDate,
        },
      },
    });

    const revenue = salesRecordsInRange.reduce((sum, sale) => sum + (sale.quantitySold * sale.sellingPrice), 0);
    const cost = salesRecordsInRange.reduce((sum, sale) => sum + (sale.productionCost || 0), 0);
    const profit = revenue - cost;

    // Get recent production batches
    const recentProductionBatches = await prisma.productionBatch.findMany({
      where: {
        status: {
          in: ['confirmed', 'ready_for_packaging'],
        },
      },
      include: {
        formulation: true,
      },
      orderBy: {
        productionDate: 'desc',
      },
      take: 5,
    });

    const recentProduction = recentProductionBatches.map(batch => ({
      batchNumber: batch.batchNumber,
      productName: batch.formulation.name,
      quantity: batch.finalOutput || batch.plannedQuantity,
      date: batch.productionDate.toISOString().split('T')[0],
    }));

    // Get recent packaging sessions
    const recentPackagingSessions = await prisma.packagingSession.findMany({
      include: {
        items: true,
        batch: {
          include: {
            formulation: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
      take: 5,
    });

    const recentPackaging = recentPackagingSessions.map(session => {
      const totalWeight = session.items.reduce((sum, item) => sum + item.totalWeight, 0);
      return {
        batchNumber: session.batch.batchNumber,
        productName: session.batch.formulation.name,
        quantity: totalWeight,
        loss: session.packagingLoss,
        date: session.date.toISOString().split('T')[0],
      };
    });

    // Get recent sales
    const recentSalesRecords = await prisma.salesRecord.findMany({
      include: {
        product: true,
      },
      orderBy: {
        saleDate: 'desc',
      },
      take: 5,
    });

    const recentSales = recentSalesRecords.map(sale => ({
      productName: sale.product.name,
      quantity: sale.quantitySold,
      totalAmount: sale.quantitySold * sale.sellingPrice,
      date: sale.saleDate.toISOString().split('T')[0],
    }));

    // Format low stock items
    const lowStockItemsFormatted = materialsWithStock
      .filter(m => m.availableStock <= m.minimumStock)
      .map(m => ({
        id: m.id,
        name: m.name,
        availableStock: m.availableStock,
        minimumStock: m.minimumStock,
        unit: m.unit.toLowerCase() as 'kg' | 'gm',
        status: m.availableStock <= 0 ? 'critical' as const : 'low' as const,
      }))
      .sort((a, b) => a.availableStock - b.availableStock);

    // Get materials count
    const activeMaterialsCount = materialsWithStock.filter(m => m.status === 'active').length;

    return NextResponse.json({
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      todayProduction,
      todayPackaging,
      todaySales,
      packagingLoss,
      profitSnapshot: {
        profit,
        revenue,
        cost,
      },
      lowStockItems: lowStockItemsFormatted,
      recentProduction,
      recentPackaging,
      recentSales,
      materialsCount: activeMaterialsCount,
    }, { status: 200 });

  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
