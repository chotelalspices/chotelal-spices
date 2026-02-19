export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      include: {
        userRoles: {
          select: { role: true }
        }
      }
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

    // Check if user is admin (only admins can edit sales)
    if (!user.userRoles.some(ur => ur.role === "admin")) {
      return NextResponse.json(
        {
          error:
            "Access denied. Only administrators can edit sales records.",
        },
        { status: 403 }
      );
    }

    // Await params to get the ID
    const { id } = await params;

    // Fetch the specific sales record
    const salesRecord = await prisma.salesRecord.findUnique({
      where: { id },
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

    if (!salesRecord) {
      return NextResponse.json(
        { error: "Sales record not found" },
        { status: 404 }
      );
    }

    // Transform the data to match the frontend interface
    const transformedRecord = {
      id: salesRecord.id,
      productId: salesRecord.productId,
      productName: salesRecord.product.name,
      batchId: null,
      batchNumber: null,
      clientName: salesRecord.clientName || null,
      voucherNo: salesRecord.voucherNo || null,
      voucherType: salesRecord.voucherType || null,
      quantitySold: salesRecord.quantitySold,
      unit: salesRecord.unit,
      sellingPricePerUnit: salesRecord.sellingPrice,
      discount: salesRecord.discount || 0,
      totalAmount: (salesRecord.quantitySold * salesRecord.sellingPrice) - ((salesRecord.quantitySold * salesRecord.sellingPrice) * ((salesRecord.discount || 0) / 100)),
      productionCostPerUnit: salesRecord.productionCost ? salesRecord.productionCost / salesRecord.quantitySold : 0,
      productionCostTotal: salesRecord.productionCost || 0,
      profit: salesRecord.profit || 0,
      saleDate: salesRecord.saleDate.toISOString().split('T')[0],
      remarks: salesRecord.remarks,
      createdBy: salesRecord.createdBy.fullName,
      createdAt: salesRecord.createdAt.toISOString(),
    };

    return NextResponse.json(transformedRecord, { status: 200 });
  } catch (error) {
    console.error("Error fetching sales record:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales record" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      include: {
        userRoles: {
          select: { role: true }
        }
      }
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

    // Check if user is admin (only admins can edit sales)
    if (!user.userRoles.some(ur => ur.role === "admin")) {
      return NextResponse.json(
        {
          error:
            "Access denied. Only administrators can edit sales records.",
        },
        { status: 403 }
      );
    }

    // Await params to get the ID
    const { id } = await params;

    // Get the existing sales record
    const existingRecord = await prisma.salesRecord.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });

    if (!existingRecord) {
      return NextResponse.json(
        { error: "Sales record not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { quantitySold, sellingPrice, discount, remarks } = body;

    // Validate required fields
    if (quantitySold === undefined || quantitySold === null || sellingPrice === undefined || sellingPrice === null) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: quantitySold and sellingPrice are required",
        },
        { status: 400 }
      );
    }

    // Validate discount
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

    // Validate selling price
    const parsedSellingPrice = parseFloat(sellingPrice);
    if (isNaN(parsedSellingPrice) || parsedSellingPrice < 0) {
      return NextResponse.json(
        { error: "Selling price must be a valid number (0 or positive)." },
        { status: 400 }
      );
    }

    // Calculate the difference in quantity
    const quantityDifference = parsedQuantity - existingRecord.quantitySold;

    // Check if there's enough stock if increasing quantity
    if (quantityDifference > 0) {
      const availablePackets = existingRecord.product.availableInventory || 0;
      
      if (quantityDifference > availablePackets) {
        return NextResponse.json(
          {
            error: `Insufficient stock. Available: ${availablePackets} packets, Additional needed: ${quantityDifference} packets`,
          },
          { status: 400 }
        );
      }
    }

    // Check if this is a free product
    const isFreeProduct = parsedSellingPrice === 0;
    
    // For free products, discount should be 0
    const finalDiscount = isFreeProduct ? 0 : (discount ? parseFloat(discount) : 0);
    
    // Update sales record and adjust product quantity in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update sales record
      const updatedSalesRecord = await tx.salesRecord.update({
        where: { id },
        data: {
          quantitySold: parsedQuantity,
          sellingPrice: parsedSellingPrice,
          discount: finalDiscount,
          remarks: remarks || null,
          // Calculate production cost per unit and total for new quantity
          productionCost: existingRecord.productionCost 
            ? (existingRecord.productionCost / existingRecord.quantitySold) * parsedQuantity
            : undefined,
          // Recalculate profit based on new totals with discount
          profit: isFreeProduct ? 0 : (existingRecord.productionCost 
            ? (parsedQuantity * parsedSellingPrice * (1 - finalDiscount / 100)) - ((existingRecord.productionCost / existingRecord.quantitySold) * parsedQuantity)
            : (parsedQuantity * parsedSellingPrice * (1 - finalDiscount / 100))),
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

      // Update finished product quantity (reverse the original quantity and apply new quantity)
      await tx.finishedProduct.update({
        where: { id: existingRecord.productId },
        data: {
          quantity: existingRecord.product.quantity + existingRecord.quantitySold - parsedQuantity,
        },
      });

      return updatedSalesRecord;
    });

    // Transform the response data
    const transformedResult = {
      id: result.id,
      productId: result.productId,
      productName: result.product.name,
      batchId: null,
      batchNumber: null,
      clientName: result.clientName || null,
      voucherNo: result.voucherNo || null,
      voucherType: result.voucherType || null,
      quantitySold: result.quantitySold,
      unit: result.unit,
      sellingPricePerUnit: result.sellingPrice,
      discount: result.discount || 0,
      totalAmount: (result.quantitySold * result.sellingPrice) - ((result.quantitySold * result.sellingPrice) * ((result.discount || 0) / 100)),
      productionCostPerUnit: result.productionCost ? result.productionCost / result.quantitySold : 0,
      productionCostTotal: result.productionCost || 0,
      profit: result.profit || 0,
      saleDate: result.saleDate.toISOString().split('T')[0],
      remarks: result.remarks,
      createdBy: result.createdBy.fullName,
      createdAt: result.createdAt.toISOString(),
    };

    return NextResponse.json(transformedResult, { status: 200 });
  } catch (error) {
    console.error("Error updating sales record:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to update sales record" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      include: {
        userRoles: {
          select: { role: true }
        }
      }
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

    // Check if user is admin (only admins can delete sales)
    if (!user.userRoles.some(ur => ur.role === "admin")) {
      return NextResponse.json(
        {
          error:
            "Access denied. Only administrators can delete sales records.",
        },
        { status: 403 }
      );
    }

    // Await params to get the ID
    const { id } = await params;

    // Get the existing sales record with product info
    const existingRecord = await prisma.salesRecord.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });

    if (!existingRecord) {
      return NextResponse.json(
        { error: "Sales record not found" },
        { status: 404 }
      );
    }

    // Delete sales record and restore product quantity in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete the sales record
      await tx.salesRecord.delete({
        where: { id },
      });

      // Restore the finished product quantity
      await tx.finishedProduct.update({
        where: { id: existingRecord.productId },
        data: {
          quantity: (existingRecord.product.availableInventory || 0) + existingRecord.quantitySold,
        },
      });
    });

    return NextResponse.json(
      { message: "Sales record deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting sales record:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to delete sales record" },
      { status: 500 }
    );
  }
}
