export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

function getSessionPackagedQuantity(session: {
  remarks: string | null;
  semiPackaged: number;
  items: Array<{ totalWeight: number }>;
}) {
  const itemsWeight = session.items.reduce((sum, item) => sum + item.totalWeight, 0);
  if (itemsWeight > 0) return itemsWeight;

  if (session.remarks?.includes("Total:")) {
    const match = session.remarks.match(/Total:\s*([\d.]+)kg/);
    if (match) {
      const parsed = parseFloat(match[1]);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }

  return session.semiPackaged || 0;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDateLabel(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function getPaymentStatus(totalAmount: number, amountPaid: number | null, paymentStatus: string | null) {
  const paid = Math.min(Math.max(amountPaid ?? (paymentStatus === "paid" ? totalAmount : 0), 0), totalAmount);
  const due = Math.max(0, totalAmount - paid);

  if (totalAmount <= 0 || due <= 0) return "Paid";
  if (paid > 0) return "Partial";
  return "Unpaid";
}

function getPaidAmount(totalAmount: number, amountPaid: number | null, paymentStatus: string | null) {
  return Math.min(Math.max(amountPaid ?? (paymentStatus === "paid" ? totalAmount : 0), 0), totalAmount);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized. Please log in to perform this action." }, { status: 401 });
    }
    const authenticatedUserId = (session.user as { id?: string }).id;
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
        (sum, session) => sum + getSessionPackagedQuantity(session),
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
      include: { items: true },
    });

    const packagingLoss = packagingSessionsInRange.reduce(
      (sum, session) => sum + session.packagingLoss, 0
    );

    // ── Profit snapshot (date range) ──────────────────────────────────────────
    const salesRecordsInRange = await prisma.salesRecord.findMany({
      where: { saleDate: { gte: startDate, lt: endDate } },
      include: { product: true },
    });

    const productionBatchesInRange = await prisma.productionBatch.findMany({
      where: {
        productionDate: { gte: startDate, lt: endDate },
        status: { in: ["confirmed", "ready_for_packaging"] },
      },
    });

    const revenue = salesRecordsInRange.reduce(
      (sum, sale) => sum + sale.quantitySold * sale.sellingPrice, 0
    );
    const cost = salesRecordsInRange.reduce(
      (sum, sale) => sum + (sale.productionCost || 0), 0
    );
    const profit = revenue - cost;

    const trendMap = new Map<
      string,
      {
        date: string;
        label: string;
        salesRevenue: number;
        salesQuantity: number;
        profit: number;
        productionQuantity: number;
        packagingQuantity: number;
        packagingLoss: number;
      }
    >();

    for (const cursor = new Date(startDate); cursor < endDate; cursor.setDate(cursor.getDate() + 1)) {
      const day = new Date(cursor);
      const key = formatDateKey(day);
      trendMap.set(key, {
        date: key,
        label: formatShortDateLabel(day),
        salesRevenue: 0,
        salesQuantity: 0,
        profit: 0,
        productionQuantity: 0,
        packagingQuantity: 0,
        packagingLoss: 0,
      });
    }

    const productSalesMap = new Map<string, { name: string; value: number; quantity: number }>();
    const clientSalesMap = new Map<string, { name: string; value: number; quantity: number; orders: number }>();
    const citySalesMap = new Map<string, { name: string; value: number; quantity: number }>();
    const salesmanSalesMap = new Map<string, { name: string; value: number; quantity: number }>();
    const paymentStatusMap = new Map<string, number>([
      ["Paid", 0],
      ["Partial", 0],
      ["Unpaid", 0],
    ]);
    let paidAmount = 0;
    let outstandingAmount = 0;

    const clientMetaDelegate = prisma as unknown as {
      clientMeta: {
        findMany: (args: {
          select: { clientName: true; city: true; salesman: true };
        }) => Promise<Array<{ clientName: string; city: string | null; salesman: string | null }>>;
      };
    };
    const clientMetas = await clientMetaDelegate.clientMeta.findMany({
      select: { clientName: true, city: true, salesman: true },
    });
    const clientMetaMap = new Map(clientMetas.map((meta) => [meta.clientName.trim(), meta]));

    salesRecordsInRange.forEach((sale) => {
      const key = formatDateKey(sale.saleDate);
      const day = trendMap.get(key);
      const saleRevenue = sale.quantitySold * sale.sellingPrice;
      const saleProfit = saleRevenue - (sale.productionCost || 0);
      const paid = getPaidAmount(saleRevenue, sale.amountPaid, sale.paymentStatus);
      paidAmount += paid;
      outstandingAmount += Math.max(0, saleRevenue - paid);

      if (day) {
        day.salesRevenue += saleRevenue;
        day.salesQuantity += sale.quantitySold;
        day.profit += saleProfit;
      }

      const productName = sale.product.name;
      const product = productSalesMap.get(productName) || { name: productName, value: 0, quantity: 0 };
      product.value += saleRevenue;
      product.quantity += sale.quantitySold;
      productSalesMap.set(productName, product);

      const clientName = sale.clientName?.trim() || "Unknown Client";
      const client = clientSalesMap.get(clientName) || { name: clientName, value: 0, quantity: 0, orders: 0 };
      client.value += saleRevenue;
      client.quantity += sale.quantitySold;
      client.orders += 1;
      clientSalesMap.set(clientName, client);

      const meta = clientMetaMap.get(clientName);
      const cityName = meta?.city?.trim() || "Unassigned";
      const city = citySalesMap.get(cityName) || { name: cityName, value: 0, quantity: 0 };
      city.value += saleRevenue;
      city.quantity += sale.quantitySold;
      citySalesMap.set(cityName, city);

      const salesmanName = meta?.salesman?.trim() || "Unassigned";
      const salesman = salesmanSalesMap.get(salesmanName) || { name: salesmanName, value: 0, quantity: 0 };
      salesman.value += saleRevenue;
      salesman.quantity += sale.quantitySold;
      salesmanSalesMap.set(salesmanName, salesman);

      const status = getPaymentStatus(saleRevenue, sale.amountPaid, sale.paymentStatus);
      paymentStatusMap.set(status, (paymentStatusMap.get(status) || 0) + saleRevenue);
    });

    productionBatchesInRange.forEach((batch) => {
      const key = formatDateKey(batch.productionDate);
      const day = trendMap.get(key);
      if (day) day.productionQuantity += batch.finalOutput || batch.plannedQuantity;
    });

    packagingSessionsInRange.forEach((packagingSession) => {
      const key = formatDateKey(packagingSession.date);
      const day = trendMap.get(key);
      if (day) {
        day.packagingQuantity += getSessionPackagedQuantity(packagingSession);
        day.packagingLoss += packagingSession.packagingLoss;
      }
    });

    const productSales = Array.from(productSalesMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((item, index) => ({
        ...item,
        value: Math.round(item.value * 100) / 100,
        fill: ["#8b4a32", "#16a34a", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed"][index],
      }));

    const topClients = Array.from(clientSalesMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((item) => ({
        ...item,
        value: Math.round(item.value * 100) / 100,
      }));

    const salesByCity = Array.from(citySalesMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((item, index) => ({
        ...item,
        value: Math.round(item.value * 100) / 100,
        fill: ["#8b4a32", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#dc2626"][index],
      }));

    const salesBySalesman = Array.from(salesmanSalesMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((item, index) => ({
        ...item,
        value: Math.round(item.value * 100) / 100,
        fill: ["#2563eb", "#8b4a32", "#16a34a", "#f59e0b", "#7c3aed", "#dc2626"][index],
      }));

    const paymentStatus = Array.from(paymentStatusMap.entries())
      .map(([name, value], index) => ({
        name,
        value: Math.round(value * 100) / 100,
        fill: ["#16a34a", "#f97316", "#dc2626"][index],
      }))
      .filter((item) => item.value > 0);

    const operationsTrend = Array.from(trendMap.values()).map((item) => ({
      ...item,
      salesRevenue: Math.round(item.salesRevenue * 100) / 100,
      profit: Math.round(item.profit * 100) / 100,
      productionQuantity: Math.round(item.productionQuantity * 100) / 100,
      packagingQuantity: Math.round(item.packagingQuantity * 100) / 100,
      packagingLoss: Math.round(item.packagingLoss * 100) / 100,
    }));

    const uniqueClientCount = clientSalesMap.size;
    const salesCollection = [
      {
        name: "Received",
        value: Math.round(paidAmount * 100) / 100,
        fill: "#16a34a",
      },
      {
        name: "Outstanding",
        value: Math.round(outstandingAmount * 100) / 100,
        fill: "#dc2626",
      },
    ].filter((item) => item.value > 0);

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
      quantity: getSessionPackagedQuantity(session),
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
      clientName: sale.clientName || null,
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

    const rawInventoryValue = materialsWithStock
      .filter((m) => m.status === "active")
      .reduce((sum, m) => {
        const stockInKg = m.unit === "gm" ? m.availableStock / 1000 : m.availableStock;
        const costPerKg = m.unit === "gm" ? m.costPerUnit * 1000 : m.costPerUnit;
        return sum + stockInKg * costPerKg;
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
      return sum + stock * (label.costPerUnit ?? 0);
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
        rawInventoryValue: Math.round(rawInventoryValue * 100) / 100,
        labelInventoryValue,
        reports: {
          operationsTrend,
          productSales,
          paymentStatus,
          salesSummary: {
            revenue: Math.round(revenue * 100) / 100,
            quantity: salesRecordsInRange.reduce((sum, sale) => sum + sale.quantitySold, 0),
            orders: salesRecordsInRange.length,
            clients: uniqueClientCount,
            averageOrderValue:
              salesRecordsInRange.length > 0
                ? Math.round((revenue / salesRecordsInRange.length) * 100) / 100
                : 0,
            received: Math.round(paidAmount * 100) / 100,
            outstanding: Math.round(outstandingAmount * 100) / 100,
          },
          topClients,
          salesByCity,
          salesBySalesman,
          salesCollection,
          inventoryValue: [
            {
              name: "Raw Materials",
              value: Math.round(rawInventoryValue * 100) / 100,
              fill: "#8b4a32",
            },
            {
              name: "Labels",
              value: Math.round(labelInventoryValue * 100) / 100,
              fill: "#2563eb",
            },
          ].filter((item) => item.value > 0),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
