export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

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

    // Fetch all sales records with product information
    const salesRecords = await prisma.salesRecord.findMany({
      include: {
        product: {
          include: {
            formulation: true,
          },
        },
        createdBy: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: {
        saleDate: "desc",
      },
    });

    // Transform the data to match the frontend interface
    const transformedRecords = salesRecords.map((record) => ({
      id: record.id,
      productId: record.productId,
      productName: record.product.name,
      batchId: null,
      batchNumber: null,
      quantitySold: record.quantitySold,
      unit: record.unit,
      sellingPricePerUnit: record.sellingPrice,
      totalAmount: (record.quantitySold * record.sellingPrice) - ((record.quantitySold * record.sellingPrice) * ((record.discount || 0) / 100)),
      productionCostPerUnit: record.productionCost ? record.productionCost / record.quantitySold : 0,
      profit: record.profit || 0,
      discount: record.discount || 0,
      saleDate: record.saleDate.toISOString().split('T')[0],
      remarks: record.remarks,
      createdBy: record.createdBy.fullName,
      createdAt: record.createdAt.toISOString(),
    }));

    return NextResponse.json(transformedRecords, { status: 200 });
  } catch (error) {
    console.error("Error fetching sales records:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales records" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { productId, quantitySold, sellingPrice, discount, saleDate, remarks, productionCost, profit } = body;

    // Validate required fields
    if (!productId || !quantitySold || sellingPrice === undefined || sellingPrice === null || !saleDate) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: productId, quantitySold, sellingPrice, and saleDate are required",
        },
        { status: 400 }
      );
    }

    // Validate optional fields
    if (isNaN(parseFloat(sellingPrice)) || parseFloat(sellingPrice) < 0) {
      return NextResponse.json(
        { error: "Selling price must be a valid number (0 or positive)." },
        { status: 400 }
      );
    }

    if (productionCost !== undefined && (isNaN(parseFloat(productionCost)) || parseFloat(productionCost) < 0)) {
      return NextResponse.json(
        { error: "Production cost must be a valid positive number." },
        { status: 400 }
      );
    }

    if (profit !== undefined && (isNaN(parseFloat(profit)) || parseFloat(profit) < 0)) {
      return NextResponse.json(
        { error: "Profit must be a valid number (0 or positive)." },
        { status: 400 }
      );
    }

    if (discount !== undefined && (isNaN(parseFloat(discount)) || parseFloat(discount) < 0 || parseFloat(discount) > 100)) {
      return NextResponse.json(
        { error: "Discount must be a valid number between 0 and 100." },
        { status: 400 }
      );
    }

    // Validate quantity (in packets)
    const parsedQuantity = parseFloat(quantitySold);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0 || !Number.isInteger(parsedQuantity)) {
      return NextResponse.json(
        { error: "Quantity must be a whole number." },
        { status: 400 }
      );
    }

    // Validate date
    const saleDateObj = new Date(saleDate);
    if (isNaN(saleDateObj.getTime())) {
      return NextResponse.json(
        { error: "Invalid sale date." },
        { status: 400 }
      );
    }

    // Verify product exists
    const product = await prisma.finishedProduct.findUnique({
      where: { id: productId },
      include: {
        formulation: true,
        salesRecords: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // Calculate available packets based on product available inventory
    const totalPacketsPackaged = Math.floor(product.availableInventory || 0); // Using availableInventory field

    const availablePackets = totalPacketsPackaged;

    // Validate available quantity
    if (parsedQuantity > availablePackets) {
      return NextResponse.json(
        {
          error: `Insufficient stock. Available: ${availablePackets} packets, Requested: ${parsedQuantity} packets`,
        },
        { status: 400 }
      );
    }

    // Create sales record and update product quantity in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create sales record
      const salesRecord = await tx.salesRecord.create({
        data: {
          productId,
          quantitySold: parsedQuantity,
          unit: "kg" as "kg" | "gm",
          sellingPrice: sellingPrice,
          discount: discount ? parseFloat(discount) : 0,
          productionCost: productionCost ? parseFloat(productionCost) : null,
          profit: profit ? parseFloat(profit) : null,
          remarks: remarks || null,
          saleDate: saleDateObj,
          createdById: authenticatedUserId,
        },
        include: {
          product: {
            include: {
              formulation: true,
            },
          },
          createdBy: {
            select: {
              fullName: true,
            },
          },
        },
      });

      // Update finished product available inventory
      await tx.finishedProduct.update({
        where: { id: productId },
        data: {
          availableInventory: (product.availableInventory || 0) - parsedQuantity,
        },
      });

      return salesRecord;
    });

    return NextResponse.json(
      {
        id: result.id,
        productId: result.productId,
        productName: result.product.name,
        batchId: null,
        batchNumber: null,
        quantitySold: result.quantitySold,
        unit: result.unit,
        sellingPrice: result.sellingPrice,
        productionCost: result.productionCost,
        profit: result.profit,
        discount: result.discount,
        remarks: result.remarks,
        totalAmount: (result.quantitySold * result.sellingPrice) - ((result.quantitySold * result.sellingPrice) * ((result.discount || 0) / 100)),
        saleDate: result.saleDate.toISOString(),
        createdBy: result.createdBy.fullName,
        createdAt: result.createdAt.toISOString(),
        remainingQuantity: (product.availableInventory || 0) - parsedQuantity,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating sales record:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to create sales record" },
      { status: 500 }
    );
  }
}
