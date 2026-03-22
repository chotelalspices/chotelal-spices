export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized. Please log in to perform this action." }, { status: 401 });
    }
    const authenticatedUserId = (session.user as any).id as string;
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "User ID not found in session." }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
    if (!user) {
      return NextResponse.json({ error: "User not found in database." }, { status: 401 });
    }
    if (user.status !== "active") {
      return NextResponse.json({ error: "Your account is not active. Please contact an administrator." }, { status: 403 });
    }

    // ── Date range ────────────────────────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get("dateRange") || "month";
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date();

    switch (dateRange) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        break;
      case "week": {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        startDate = weekStart;
        break;
      }
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarter": {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
        break;
      }
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // ── Raw materials & stock ─────────────────────────────────────────────────
    const rawMaterials = await prisma.rawMaterial.findMany({
      include: { stockMovements: { orderBy: { createdAt: "asc" } } },
    });

    const materialsWithStock = rawMaterials.map((material) => {
      const availableStock = material.stockMovements.reduce(
        (total, movement) =>
          movement.action === "add" ? total + movement.quantity : total - movement.quantity,
        0
      );
      return { ...material, availableStock };
    });

    const lowStockItems = materialsWithStock.filter(
      (m) => m.availableStock > 0 && m.availableStock <= m.minimumStock
    );
    const outOfStockItems = materialsWithStock.filter((m) => m.availableStock <= 0);

    // ── Today production ──────────────────────────────────────────────────────
    const todayProductionBatches = await prisma.productionBatch.findMany({
      where: {
        productionDate: { gte: todayStart, lt: todayEnd },
        status: { in: ["confirmed", "ready_for_packaging"] },
      },
      include: { formulation: true },
    });

    const todayProduction = {
      quantity: todayProductionBatches.reduce(
        (sum, batch) => sum + (batch.finalOutput || batch.plannedQuantity), 0
      ),
      batches: todayProductionBatches.length,
    };

    // ── Today packaging ───────────────────────────────────────────────────────
    const todayPackagingSessions = await prisma.packagingSession.findMany({
      where: { date: { gte: todayStart, lt: todayEnd } },
      include: { items: true, batch: { include: { formulation: true } } },
    });

    const todayPackaging = {
      quantity: todayPackagingSessions.reduce(
        (sum, session) =>
          sum + session.items.reduce((itemSum, item) => itemSum + item.totalWeight, 0),
        0
      ),
      sessions: todayPackagingSessions.length,
    };

    // ── Today sales ───────────────────────────────────────────────────────────
    const todaySalesRecords = await prisma.salesRecord.findMany({
      where: { saleDate: { gte: todayStart, lt: todayEnd } },
      include: { product: true },
    });

    const todaySales = {
      quantity: todaySalesRecords.reduce((sum, sale) => sum + sale.quantitySold, 0),
      revenue: todaySalesRecords.reduce(
        (sum, sale) => sum + sale.quantitySold * sale.sellingPrice, 0
      ),
      count: todaySalesRecords.length,
    };

    // ── Packaging loss (date range) ───────────────────────────────────────────
    const packagingSessionsInRange = await prisma.packagingSession.findMany({
      where: { date: { gte: startDate, lt: endDate } },
    });

    const packagingLoss = packagingSessionsInRange.reduce(
      (sum, session) => sum + session.packagingLoss, 0
    );

    // ── Profit snapshot (date range) ──────────────────────────────────────────
    const salesRecordsInRange = await prisma.salesRecord.findMany({
      where: { saleDate: { gte: startDate, lt: endDate } },
    });

    const revenue = salesRecordsInRange.reduce(
      (sum, sale) => sum + sale.quantitySold * sale.sellingPrice, 0
    );
    const cost = salesRecordsInRange.reduce(
      (sum, sale) => sum + (sale.productionCost || 0), 0
    );
    const profit = revenue - cost;

    // ── Recent production ─────────────────────────────────────────────────────
    const recentProductionBatches = await prisma.productionBatch.findMany({
      where: { status: { in: ["confirmed", "ready_for_packaging"] } },
      include: { formulation: true },
      orderBy: { productionDate: "desc" },
      take: 5,
    });

    const recentProduction = recentProductionBatches.map((batch) => ({
      batchNumber: batch.batchNumber,
      productName: batch.formulation.name,
      quantity: batch.finalOutput || batch.plannedQuantity,
      date: batch.productionDate.toISOString().split("T")[0],
    }));

    // ── Recent packaging ──────────────────────────────────────────────────────
    const recentPackagingSessions = await prisma.packagingSession.findMany({
      include: { items: true, batch: { include: { formulation: true } } },
      orderBy: { date: "desc" },
      take: 5,
    });

    const recentPackaging = recentPackagingSessions.map((session) => ({
      batchNumber: session.batch.batchNumber,
      productName: session.batch.formulation.name,
      quantity: session.items.reduce((sum, item) => sum + item.totalWeight, 0),
      loss: session.packagingLoss,
      date: session.date.toISOString().split("T")[0],
    }));

    // ── Recent sales ──────────────────────────────────────────────────────────
    const recentSalesRecords = await prisma.salesRecord.findMany({
      include: { product: true },
      orderBy: { saleDate: "desc" },
      take: 5,
    });

    const recentSales = recentSalesRecords.map((sale) => ({
      productName: sale.product.name,
      quantity: sale.quantitySold,
      totalAmount: sale.quantitySold * sale.sellingPrice,
      date: sale.saleDate.toISOString().split("T")[0],
    }));

    // ── Low stock formatted ───────────────────────────────────────────────────
    const lowStockItemsFormatted = materialsWithStock
      .filter((m) => m.availableStock <= m.minimumStock)
      .map((m) => ({
        id: m.id,
        name: m.name,
        availableStock: m.availableStock,
        minimumStock: m.minimumStock,
        unit: m.unit.toLowerCase() as "kg" | "gm",
        status: m.availableStock <= 0 ? ("critical" as const) : ("low" as const),
      }))
      .sort((a, b) => a.availableStock - b.availableStock);

    const activeMaterialsCount = materialsWithStock.filter(
      (m) => m.status === "active"
    ).length;

    const totalStock = materialsWithStock
  .filter((m) => m.status === "active")
  .reduce((sum, m) => {
    return sum + (m.unit === "gm" ? m.availableStock / 1000 : m.availableStock);
  }, 0);

    // ── Label inventory value ─────────────────────────────────────────────────
    const labelsWithMovements = await prisma.label.findMany({
      include: { labelMovements: true },
    });

    const labelInventoryValue = labelsWithMovements.reduce((sum, label) => {
      const stock = label.labelMovements.reduce(
        (s, m) => (m.action === "add" ? s + m.quantity : s - m.quantity),
        0
      );
      return sum + stock * ((label as any).costPerUnit ?? 0);
    }, 0);

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        todayProduction,
        todayPackaging,
        todaySales,
        packagingLoss,
        profitSnapshot: { profit, revenue, cost },
        lowStockItems: lowStockItemsFormatted,
        recentProduction,
        recentPackaging,
        recentSales,
        materialsCount: activeMaterialsCount,
        totalStock: Math.round(totalStock * 100) / 100, 
        labelInventoryValue,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}