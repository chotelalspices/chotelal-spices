export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

const CHUNK_SIZE = 100;

function parseSaleDate(input: unknown): Date {
  if (!input) return new Date();
  const value = String(input).trim();
  if (!value) return new Date();

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const normalized = value.replace(/,/g, "");
  const parts = normalized.split(/[\s/-]+/).filter(Boolean);
  if (parts.length === 3) {
    const [dayPart, monthPart, yearPart] = parts;
    const day = Number(dayPart);
    const month = new Date(`${monthPart} 1, 2000`).getMonth();
    const year = Number(yearPart.length === 2 ? `20${yearPart}` : yearPart);
    if (!Number.isNaN(day) && !Number.isNaN(month) && !Number.isNaN(year)) {
      const parsed = new Date(year, month, day);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  return new Date();
}

async function deductProductPool(
  tx: any,
  products: Array<{ id: string; availableInventory: number | null }>,
  fallbackProductId: string,
  quantity: number
) {
  let remaining = quantity;

  for (const product of products) {
    if (remaining <= 0) break;
    const currentStock = product.availableInventory || 0;
    if (currentStock <= 0) continue;

    const deduction = Math.min(currentStock, remaining);
    await tx.finishedProduct.update({
      where: { id: product.id },
      data: { availableInventory: currentStock - deduction },
    });
    product.availableInventory = currentStock - deduction;
    remaining -= deduction;
  }

  if (remaining > 0) {
    const fallback = products.find((product) => product.id === fallbackProductId) || products[0];
    if (fallback) {
      await tx.finishedProduct.update({
        where: { id: fallback.id },
        data: { availableInventory: (fallback.availableInventory || 0) - remaining },
      });
      fallback.availableInventory = (fallback.availableInventory || 0) - remaining;
    }
  }
}

export async function POST(request: NextRequest) {
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
    if (!user || user.status !== "active") {
      return NextResponse.json(
        { error: "User not found or account not active" },
        { status: user ? 403 : 401 }
      );
    }

    const body = await request.json();
    const { sales } = body;

    if (!sales || !Array.isArray(sales) || sales.length === 0) {
      return NextResponse.json(
        { error: "Sales data is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    const errors: Array<{ row: number; error: string }> = [];
    const productIds = [...new Set(sales.map((s: any) => s.productId).filter(Boolean))];
    const products = await prisma.finishedProduct.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, availableInventory: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const productNames = [...new Set(products.map((p) => p.name))];
    const groupedInventoryProducts = await prisma.finishedProduct.findMany({
      where: { name: { in: productNames } },
      select: { id: true, name: true, availableInventory: true, createdAt: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const productsBySelectedId = new Map(
      products.map((product) => [
        product.id,
        groupedInventoryProducts.filter((inventoryProduct) => inventoryProduct.name === product.name),
      ])
    );
    const remainingStock = new Map(
      products.map((product) => [
        product.id,
        (productsBySelectedId.get(product.id) || []).reduce(
          (sum, inventoryProduct) => sum + (inventoryProduct.availableInventory || 0),
          0
        ),
      ])
    );

    const validatedSales: Array<{
      productId: string;
      clientName: string | null;
      voucherNo: string | null;
      voucherType: string | null;
      quantitySold: number;
      sellingPrice: number;
      discount: number;
      productionCost: number;
      profit: number;
      remarks: string | null;
      saleDate: Date;
    }> = [];

    for (let i = 0; i < sales.length; i++) {
      const sale = sales[i];

      if (!sale.productId || !sale.numberOfPackets) {
        errors.push({ row: i + 1, error: "Missing required fields: productId, numberOfPackets" });
        continue;
      }

      const parsedQuantity = parseInt(String(sale.numberOfPackets), 10);
      const parsedPrice = sale.sellingPricePerPacket ? parseFloat(String(sale.sellingPricePerPacket)) : 0;
      const parsedDiscount = sale.discount ? parseFloat(String(sale.discount)) : 0;

      if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0 || !Number.isInteger(parsedQuantity)) {
        errors.push({ row: i + 1, error: "Invalid quantity" });
        continue;
      }
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        errors.push({ row: i + 1, error: "Invalid selling price (cannot be negative)" });
        continue;
      }
      if (Number.isNaN(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) {
        errors.push({ row: i + 1, error: "Invalid discount (0-100)" });
        continue;
      }

      const product = productMap.get(sale.productId);
      if (!product) {
        errors.push({ row: i + 1, error: "Product not found" });
        continue;
      }

      const currentRemaining = remainingStock.get(product.id) ?? 0;
      if (parsedQuantity > currentRemaining) {
        errors.push({
          row: i + 1,
          error: `Insufficient stock. Available: ${currentRemaining}, Requested: ${parsedQuantity}`,
        });
        continue;
      }

      remainingStock.set(product.id, currentRemaining - parsedQuantity);

      const totalAmount = parsedQuantity * parsedPrice;
      const discountAmount = totalAmount * (parsedDiscount / 100);
      const finalAmount = totalAmount - discountAmount;
      const isFree = finalAmount === 0;
      const providedProductionCost = sale.productionCost ? parseFloat(String(sale.productionCost)) : 0;
      const productionCost = Number.isNaN(providedProductionCost) ? 0 : providedProductionCost;
      const profit = isFree ? 0 : finalAmount - productionCost;

      validatedSales.push({
        productId: sale.productId,
        clientName: sale.clientName || null,
        voucherNo: sale.voucherNo || null,
        voucherType: sale.voucherType || null,
        quantitySold: parsedQuantity,
        sellingPrice: parsedPrice,
        discount: parsedDiscount,
        productionCost,
        profit,
        remarks: sale.remarks || null,
        saleDate: parseSaleDate(sale.saleDate),
      });
    }

    let successCount = 0;
    const chunkFailures: Array<{ row: number; error: string }> = [];

    for (let start = 0; start < validatedSales.length; start += CHUNK_SIZE) {
      const chunk = validatedSales.slice(start, start + CHUNK_SIZE);
      const inventoryUpdates = new Map<string, number>();

      for (const sale of chunk) {
        inventoryUpdates.set(
          sale.productId,
          (inventoryUpdates.get(sale.productId) || 0) + sale.quantitySold
        );
      }

      try {
        const inserted = await prisma.$transaction(async (tx) => {
          const createResult = await tx.salesRecord.createMany({
            data: chunk.map((sale) => ({
              productId: sale.productId,
              clientName: sale.clientName,
              voucherNo: sale.voucherNo,
              voucherType: sale.voucherType,
              quantitySold: sale.quantitySold,
              unit: "kg",
              sellingPrice: sale.sellingPrice,
              discount: sale.discount,
              productionCost: sale.productionCost,
              profit: sale.profit,
              remarks: sale.remarks,
              saleDate: sale.saleDate,
              createdById: authenticatedUserId,
            })),
          });

          for (const [productId, totalDeduction] of inventoryUpdates.entries()) {
            await deductProductPool(tx, productsBySelectedId.get(productId) || [], productId, totalDeduction);
          }

          return createResult.count;
        }, { timeout: 45000 });

        successCount += inserted;
      } catch (error) {
        for (let i = 0; i < chunk.length; i++) {
          chunkFailures.push({
            row: start + i + 1,
            error: error instanceof Error ? error.message : "Chunk import failed",
          });
        }
      }
    }

    const allErrors = [...errors, ...chunkFailures];

    return NextResponse.json({
      success: successCount > 0,
      message: `Successfully created ${successCount} sales records`,
      errors: allErrors,
      totalProcessed: sales.length,
      successCount,
      errorCount: allErrors.length,
    });
  } catch (error) {
    console.error("Error in bulk sales upload:", error);
    return NextResponse.json({ error: "Failed to process bulk sales upload" }, { status: 500 });
  }
}
