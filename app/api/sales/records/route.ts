export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

async function getAuthUser(request?: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: "Unauthorized. Please log in.", status: 401 };
  const id = (session.user as any).id as string;
  if (!id) return { error: "User ID not found in session.", status: 401 };
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "User not found in database.", status: 401 };
  if (user.status !== "active") return { error: "Your account is not active.", status: 403 };
  return { userId: id };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const city     = searchParams.get('city')     || null;
    const salesman = searchParams.get('salesman') || null;

    // If city or salesman filter active, find matching clientNames from ClientMeta
    let filteredClientNames: string[] | null = null;
    if (city || salesman) {
      const metaWhere: any = {};
      if (city)     metaWhere.city     = city;
      if (salesman) metaWhere.salesman = salesman;

      const matchingMetas = await (prisma as any).clientMeta.findMany({
        where: metaWhere,
        select: { clientName: true },
      });

      filteredClientNames = matchingMetas.map((m: any) => m.clientName);
    }

    const salesRecords = await prisma.salesRecord.findMany({
      where: {
        ...(filteredClientNames !== null && {
          clientName: { in: filteredClientNames },
        }),
      },
      include: {
        product: { include: { formulation: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: { saleDate: "desc" },
    });

    const transformedRecords = salesRecords.map((record) => {
      const gross = record.quantitySold * record.sellingPrice;
      const totalAmount = gross - gross * ((record.discount || 0) / 100);
      return {
        id: record.id,
        productId: record.productId,
        productName: record.product.name,
        batchId: null,
        batchNumber: null,
        clientName: record.clientName || null,
        city: (record as any).city || null,
        voucherNo: record.voucherNo || null,
        voucherType: record.voucherType || null,
        quantitySold: record.quantitySold,
        unit: record.unit,
        sellingPricePerUnit: record.sellingPrice,
        totalAmount,
        productionCostPerUnit: record.productionCost
          ? record.productionCost / record.quantitySold
          : 0,
        profit: record.profit || 0,
        discount: record.discount || 0,
        saleDate: record.saleDate.toISOString().split("T")[0],
        remarks: record.remarks,
        paymentStatus: record.paymentStatus || "paid",
        amountPaid: record.amountPaid ?? totalAmount,
        amountDue: record.amountDue || 0,
        paymentNote: record.paymentNote || null,
        createdBy: record.createdBy?.fullName ?? null,
        createdAt: record.createdAt.toISOString(),
      };
    });

    return NextResponse.json(transformedRecords, { status: 200 });
  } catch (error) {
    console.error("Error fetching sales records:", error);
    return NextResponse.json({ error: "Failed to fetch sales records" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { userId } = auth;

    const body = await request.json();
    const {
      productId, quantitySold, sellingPrice, discount, saleDate,
      remarks, productionCost, profit, clientName, city,
      voucherNo, voucherType,
    } = body;

    if (!productId || !quantitySold || sellingPrice === undefined || !saleDate) {
      return NextResponse.json(
        { error: "Missing required fields: productId, quantitySold, sellingPrice, saleDate" },
        { status: 400 }
      );
    }

    if (isNaN(parseFloat(sellingPrice)) || parseFloat(sellingPrice) < 0) {
      return NextResponse.json({ error: "Selling price must be a valid number (0 or positive)." }, { status: 400 });
    }

    const parsedQuantity = parseFloat(quantitySold);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0 || !Number.isInteger(parsedQuantity)) {
      return NextResponse.json({ error: "Quantity must be a whole number." }, { status: 400 });
    }

    const saleDateObj = new Date(saleDate);
    if (isNaN(saleDateObj.getTime())) {
      return NextResponse.json({ error: "Invalid sale date." }, { status: 400 });
    }

    const product = await prisma.finishedProduct.findUnique({
      where: { id: productId },
      include: { formulation: true, salesRecords: true },
    });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const availablePackets = Math.floor(product.availableInventory || 0);
    if (parsedQuantity > availablePackets) {
      return NextResponse.json(
        { error: `Insufficient stock. Available: ${availablePackets} packets, Requested: ${parsedQuantity} packets` },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const salesRecord = await tx.salesRecord.create({
        data: {
          productId,
          clientName: clientName || null,
          city: city?.trim() || null,               // ← city
          voucherNo: voucherNo || null,
          voucherType: voucherType || null,
          quantitySold: parsedQuantity,
          unit: "kg" as "kg" | "gm",
          sellingPrice,
          discount: discount ? parseFloat(discount) : 0,
          productionCost: productionCost ? parseFloat(productionCost) : 0,
          profit: profit ? parseFloat(profit) : 0,
          remarks: remarks || null,
          saleDate: saleDateObj,
          createdById: userId,
        } as any,
        include: {
          product: { include: { formulation: true } },
          createdBy: { select: { fullName: true } },
        },
      });

      await tx.finishedProduct.update({
        where: { id: productId },
        data: { availableInventory: (product.availableInventory || 0) - parsedQuantity },
      });

      return salesRecord;
    });

    const gross = result.quantitySold * result.sellingPrice;
    const totalAmount = gross - gross * ((result.discount || 0) / 100);

    return NextResponse.json(
      {
        id: result.id,
        productId: result.productId,
        productName: result.product.name,
        batchId: null, batchNumber: null,
        clientName: result.clientName || null,
        city: (result as any).city || null,
        voucherNo: result.voucherNo || null,
        voucherType: result.voucherType || null,
        quantitySold: result.quantitySold,
        unit: result.unit,
        sellingPrice: result.sellingPrice,
        productionCost: result.productionCost,
        profit: result.profit,
        discount: result.discount,
        remarks: result.remarks,
        totalAmount,
        saleDate: result.saleDate.toISOString(),
        createdBy: result.createdBy?.fullName ?? null,
        createdAt: result.createdAt.toISOString(),
        remainingQuantity: (product.availableInventory || 0) - parsedQuantity,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating sales record:", error);
    return NextResponse.json({ error: "Failed to create sales record" }, { status: 500 });
  }
}