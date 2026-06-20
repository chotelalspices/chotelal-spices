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

function formatMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
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

function getSaleFinalAmount(sale: { quantitySold: number; sellingPrice: number; discount: number | null; totalAmount?: number | null }) {
  if (sale.totalAmount != null) return sale.totalAmount;
  const gross = sale.quantitySold * sale.sellingPrice;
  return gross - gross * ((sale.discount || 0) / 100);
}

function getSalesReportGroupKey(sale: {
  clientName: string | null;
  saleDate: Date;
  voucherType: string | null;
  voucherNo: string | null;
}) {
  const clientName = sale.clientName?.trim() || "Unknown Client";
  const voucherType = sale.voucherType?.trim() || "no-voucher-type";
  const voucherNo = sale.voucherNo?.trim() || "no-voucher";

  return [clientName, formatDateKey(sale.saleDate), voucherType, voucherNo]
    .map((part) => part.toLowerCase())
    .join("__");
}

function getCityFromClientName(clientName: string) {
  const match = clientName.match(/\(([^()]*)\)\s*$/);
  return match?.[1]?.trim() || null;
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
    const dateRange = searchParams.get("dateRange") || "all";
    const now = new Date();
    const isAllTime = dateRange === "all";
    let startDate: Date = new Date(0);
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

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
      case "all":
        break;
      default:
        startDate = new Date(0);
        break;
    }
    const rangeDateFilter = isAllTime ? undefined : { gte: startDate, lt: endDate };

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
        (sum, sale) => sum + getSaleFinalAmount(sale), 0
      ),
      count: todaySalesRecords.length,
    };

    // ── Packaging loss (date range) ───────────────────────────────────────────
    const packagingSessionsInRange = await prisma.packagingSession.findMany({
      where: rangeDateFilter ? { date: rangeDateFilter } : {},
      include: { items: true },
    });

    const packagingLoss = packagingSessionsInRange.reduce(
      (sum, session) => sum + session.packagingLoss, 0
    );

    // ── Profit snapshot (date range) ──────────────────────────────────────────
    const salesRecordsInRange = await prisma.salesRecord.findMany({
      where: rangeDateFilter ? { saleDate: rangeDateFilter } : {},
      include: { product: true },
    });

    const productionBatchesInRange = await prisma.productionBatch.findMany({
      where: {
        ...(rangeDateFilter ? { productionDate: rangeDateFilter } : {}),
        status: { in: ["confirmed", "ready_for_packaging"] },
      },
    });

    const revenue = salesRecordsInRange.reduce(
      (sum, sale) => sum + getSaleFinalAmount(sale), 0
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

    const trendDates = [
      ...salesRecordsInRange.map((sale) => sale.saleDate),
      ...productionBatchesInRange.map((batch) => batch.productionDate),
      ...packagingSessionsInRange.map((packagingSession) => packagingSession.date),
    ];
    const groupTrendByMonth = isAllTime || trendDates.some((date) => date < startDate || date >= endDate);
    const getTrendKey = (date: Date) => (groupTrendByMonth ? formatMonthKey(date) : formatDateKey(date));
    const getTrendLabel = (date: Date) => (groupTrendByMonth ? formatMonthLabel(date) : formatShortDateLabel(date));

    if (groupTrendByMonth && trendDates.length > 0) {
      const minDate = new Date(Math.min(...trendDates.map((date) => date.getTime())));
      const maxDate = new Date(Math.max(...trendDates.map((date) => date.getTime())));
      const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      const trendEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 1);

      while (cursor < trendEnd) {
        const bucketDate = new Date(cursor);
        const key = getTrendKey(bucketDate);
        trendMap.set(key, {
          date: key,
          label: getTrendLabel(bucketDate),
          salesRevenue: 0,
          salesQuantity: 0,
          profit: 0,
          productionQuantity: 0,
          packagingQuantity: 0,
          packagingLoss: 0,
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      for (const cursor = new Date(startDate); cursor < endDate; cursor.setDate(cursor.getDate() + 1)) {
        const day = new Date(cursor);
        const key = getTrendKey(day);
        trendMap.set(key, {
          date: key,
          label: getTrendLabel(day),
          salesRevenue: 0,
          salesQuantity: 0,
          profit: 0,
          productionQuantity: 0,
          packagingQuantity: 0,
          packagingLoss: 0,
        });
      }
    }

    const productSalesMap = new Map<string, { name: string; value: number; quantity: number }>();
    const clientSalesMap = new Map<string, { name: string; value: number; quantity: number; orders: number }>();
    const citySalesMap = new Map<string, { name: string; value: number; quantity: number }>();
    const salesmanSalesMap = new Map<string, { name: string; value: number; quantity: number }>();
    const salesGroupMap = new Map<
      string,
      {
        clientName: string;
        totalAmount: number;
        quantity: number;
        profit: number;
        amountPaid: number;
        amountDue: number;
        paymentStatus: string;
        lineCount: number;
      }
    >();
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
    const clientMetaMap = new Map(clientMetas.map((meta) => [meta.clientName.trim().toLowerCase(), meta]));

    salesRecordsInRange.forEach((sale) => {
      const key = getTrendKey(sale.saleDate);
      const day = trendMap.get(key);
      const saleRevenue = getSaleFinalAmount(sale);
      const saleProfit = sale.profit ?? saleRevenue - (sale.productionCost || 0);
      const paid = getPaidAmount(saleRevenue, sale.amountPaid, sale.paymentStatus);

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
      const groupKey = getSalesReportGroupKey(sale);
      const group = salesGroupMap.get(groupKey) || {
        clientName,
        totalAmount: 0,
        quantity: 0,
        profit: 0,
        amountPaid: 0,
        amountDue: 0,
        paymentStatus: "Unpaid",
        lineCount: 0,
      };
      group.totalAmount += saleRevenue;
      group.quantity += sale.quantitySold;
      group.profit += saleProfit;
      group.amountPaid += paid;
      group.lineCount += 1;
      salesGroupMap.set(groupKey, group);
    });

    const salesGroups = Array.from(salesGroupMap.values()).map((group) => {
      const amountPaid = Math.min(Math.max(group.amountPaid, 0), group.totalAmount);
      const amountDue = Math.max(0, group.totalAmount - amountPaid);
      return {
        ...group,
        amountPaid,
        amountDue,
        paymentStatus: getPaymentStatus(group.totalAmount, amountPaid, null),
      };
    });

    salesGroups.forEach((group) => {
      paidAmount += group.amountPaid;
      outstandingAmount += group.amountDue;

      const clientName = group.clientName;
      const client = clientSalesMap.get(clientName) || { name: clientName, value: 0, quantity: 0, orders: 0 };
      client.value += group.totalAmount;
      client.quantity += group.quantity;
      client.orders += 1;
      clientSalesMap.set(clientName, client);

      const meta = clientMetaMap.get(clientName.toLowerCase());
      const cityName = meta?.city?.trim() || getCityFromClientName(clientName) || "Unassigned";
      const city = citySalesMap.get(cityName) || { name: cityName, value: 0, quantity: 0 };
      city.value += group.totalAmount;
      city.quantity += group.quantity;
      citySalesMap.set(cityName, city);

      const salesmanName = meta?.salesman?.trim() || "Unassigned";
      const salesman = salesmanSalesMap.get(salesmanName) || { name: salesmanName, value: 0, quantity: 0 };
      salesman.value += group.totalAmount;
      salesman.quantity += group.quantity;
      salesmanSalesMap.set(salesmanName, salesman);

      paymentStatusMap.set(group.paymentStatus, (paymentStatusMap.get(group.paymentStatus) || 0) + group.totalAmount);
    });

    productionBatchesInRange.forEach((batch) => {
      const key = getTrendKey(batch.productionDate);
      const day = trendMap.get(key);
      if (day) day.productionQuantity += batch.finalOutput || batch.plannedQuantity;
    });

    packagingSessionsInRange.forEach((packagingSession) => {
      const key = getTrendKey(packagingSession.date);
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
      totalAmount: getSaleFinalAmount(sale),
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
            orders: salesGroups.length,
            clients: uniqueClientCount,
            averageOrderValue:
              salesGroups.length > 0
                ? Math.round((revenue / salesGroups.length) * 100) / 100
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
