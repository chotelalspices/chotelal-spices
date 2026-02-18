export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

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

    const validatedSales: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < sales.length; i++) {
      const sale = sales[i];

      try {
        if (!sale.productId || !sale.numberOfPackets) {
          errors.push({ row: i + 1, error: "Missing required fields: productId, numberOfPackets" });
          continue;
        }

        const parsedQuantity = parseInt(sale.numberOfPackets);
        const parsedPrice    = sale.sellingPricePerPacket ? parseFloat(sale.sellingPricePerPacket) : 0;
        const parsedDiscount = sale.discount ? parseFloat(sale.discount) : 0;

        if (isNaN(parsedQuantity) || parsedQuantity <= 0 || !Number.isInteger(parsedQuantity)) {
          errors.push({ row: i + 1, error: "Invalid quantity" });
          continue;
        }
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          errors.push({ row: i + 1, error: "Invalid selling price (cannot be negative)" });
          continue;
        }
        if (isNaN(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) {
          errors.push({ row: i + 1, error: "Invalid discount (0-100)" });
          continue;
        }

        const product = await prisma.finishedProduct.findUnique({
          where: { id: sale.productId },
          include: {
            formulation: {
              include: {
                productionBatches: { include: { materialUsages: true } },
              },
            },
          },
        });

        if (!product) {
          errors.push({ row: i + 1, error: "Product not found" });
          continue;
        }

        if (parsedQuantity > (product.availableInventory || 0)) {
          errors.push({
            row: i + 1,
            error: `Insufficient stock. Available: ${product.availableInventory || 0}, Requested: ${parsedQuantity}`,
          });
          continue;
        }

        // Calculate production cost per packet
        let productionCostPerPacket = 0;
        if (product.formulation.productionBatches.length > 0) {
          const recentBatch = product.formulation.productionBatches[0];
          if (recentBatch && recentBatch.materialUsages.length > 0) {
            const totalProductionCost = recentBatch.materialUsages.reduce(
              (sum: number, usage: any) => sum + usage.cost, 0
            );
            const finalOutputKg =
              recentBatch.unit === "kg"
                ? (recentBatch.finalOutput ?? recentBatch.plannedQuantity)
                : (recentBatch.finalOutput ?? recentBatch.plannedQuantity) / 1000;

            if (finalOutputKg > 0) {
              const productionCostPerKg = totalProductionCost / finalOutputKg;
              const nameParts = product.name.split(" ");
              const sizePart  = nameParts[nameParts.length - 1];
              let weightPerPacketKg = 0;
              if (sizePart.toLowerCase().includes("kg")) {
                weightPerPacketKg = parseFloat(sizePart.replace(/[^\d.]/g, "")) || 0;
              } else if (sizePart.toLowerCase().includes("g")) {
                weightPerPacketKg = (parseFloat(sizePart.replace(/[^\d.]/g, "")) || 0) / 1000;
              }
              productionCostPerPacket = productionCostPerKg * weightPerPacketKg;
            }
          }
        }

        const totalAmount    = parsedQuantity * parsedPrice;
        const discountAmount = totalAmount * (parsedDiscount / 100);
        const finalAmount    = totalAmount - discountAmount;
        const isFree         = finalAmount === 0;
        const productionCost = sale.productionCost || productionCostPerPacket * parsedQuantity;
        const profit         = isFree ? 0 : finalAmount - productionCost;

        // FIX 1: Parse saleDate from payload instead of hardcoding today
        let saleDateObj = new Date();
        if (sale.saleDate) {
          const parsed = new Date(sale.saleDate);
          if (!isNaN(parsed.getTime())) saleDateObj = parsed;
        }

        validatedSales.push({
          productId:    sale.productId,
          // FIX 2: Capture client fields from the upload payload
          clientName:   sale.clientName   || null,
          voucherNo:    sale.voucherNo    || null,
          voucherType:  sale.voucherType  || null,
          quantitySold: parsedQuantity,
          sellingPrice: parsedPrice,
          discount:     parsedDiscount,
          productionCost,
          profit,
          remarks:      sale.remarks || null,
          saleDate:     saleDateObj,
          currentProductQuantity: product.availableInventory || 0,
        });
      } catch (error) {
        errors.push({ row: i + 1, error: error instanceof Error ? error.message : "Unknown error" });
      }
    }

    const createdSales = await prisma.$transaction(async (tx) => {
      const results = [];
      const inventoryUpdates: Map<string, number> = new Map();

      for (const v of validatedSales) {
        const salesRecord = await tx.salesRecord.create({
          data: {
            productId:    v.productId,
            // FIX 3: Save client fields to DB
            clientName:   v.clientName,
            voucherNo:    v.voucherNo,
            voucherType:  v.voucherType,
            quantitySold: v.quantitySold,
            unit:         "kg",
            sellingPrice: v.sellingPrice,
            discount:     v.discount,
            productionCost: v.productionCost,
            profit:       v.profit,
            remarks:      v.remarks,
            saleDate:     v.saleDate,
            createdById:  authenticatedUserId,
          },
          include: {
            product: true,
            createdBy: { select: { fullName: true } },
          },
        });

        const cur = inventoryUpdates.get(v.productId) || 0;
        inventoryUpdates.set(v.productId, cur + v.quantitySold);

        results.push({
          id:           salesRecord.id,
          productId:    salesRecord.productId,
          productName:  salesRecord.product.name,
          // FIX 4: Return client fields in response
          clientName:   salesRecord.clientName,
          voucherNo:    salesRecord.voucherNo,
          voucherType:  salesRecord.voucherType,
          quantitySold: salesRecord.quantitySold,
          sellingPricePerPacket: salesRecord.sellingPrice,
          discount:     salesRecord.discount,
          finalAmount:
            v.quantitySold * v.sellingPrice -
            v.quantitySold * v.sellingPrice * (v.discount / 100),
          profit:   salesRecord.profit,
          saleDate: salesRecord.saleDate.toISOString().split("T")[0],
        });
      }

      for (const [productId, totalDeduction] of inventoryUpdates.entries()) {
        await tx.finishedProduct.update({
          where: { id: productId },
          data:  { availableInventory: { decrement: totalDeduction } },
        });
      }

      return results;
    }, { timeout: 30000 });

    return NextResponse.json({
      success:        true,
      message:        `Successfully created ${createdSales.length} sales records`,
      created:        createdSales,
      errors,
      totalProcessed: sales.length,
      successCount:   createdSales.length,
      errorCount:     errors.length,
    });
  } catch (error) {
    console.error("Error in bulk sales upload:", error);
    return NextResponse.json({ error: "Failed to process bulk sales upload" }, { status: 500 });
  }
}
