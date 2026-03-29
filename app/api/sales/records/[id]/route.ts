export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: "Unauthorized. Please log in.", status: 401 };
  const id = (session.user as any).id as string;
  if (!id) return { error: "User ID not found in session.", status: 401 };
  const user = await prisma.user.findUnique({
    where: { id },
    include: { userRoles: { select: { role: true } } },
  });
  if (!user) return { error: "User not found in database.", status: 401 };
  if (user.status !== "active") return { error: "Your account is not active.", status: 403 };
  if (!user.userRoles.some((ur) => ur.role === "admin")) {
    return { error: "Access denied. Only administrators can manage sales records.", status: 403 };
  }
  return { userId: id };
}

// ─── Audit log helper ─────────────────────────────────────────────────────────

async function writeAuditLog(
  salesRecordId: string,
  changedById: string,
  action: "edit" | "delete" | "payment",
  changes: object
) {
  try {
    await (prisma as any).salesAuditLog.create({
      data: { salesRecordId, changedById, action, changes },
    });
  } catch (e) {
    console.error("Audit log write failed:", e);
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthAdmin();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;

    const salesRecord = await prisma.salesRecord.findUnique({
      where: { id },
      include: {
        product: { include: { formulation: true } },
        createdBy: { select: { fullName: true } },
      },
    });

    if (!salesRecord) {
      return NextResponse.json({ error: "Sales record not found" }, { status: 404 });
    }

    const gross = salesRecord.quantitySold * salesRecord.sellingPrice;
    const totalAmount = gross - gross * ((salesRecord.discount || 0) / 100);

    return NextResponse.json({
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
      totalAmount,
      productionCostPerUnit: salesRecord.productionCost
        ? salesRecord.productionCost / salesRecord.quantitySold
        : 0,
      productionCostTotal: salesRecord.productionCost || 0,
      profit: salesRecord.profit || 0,
      saleDate: salesRecord.saleDate.toISOString().split("T")[0],
      remarks: salesRecord.remarks,
      paymentStatus: salesRecord.paymentStatus || "paid",
      amountPaid: salesRecord.amountPaid ?? totalAmount,
      amountDue: salesRecord.amountDue || 0,
      paymentNote: salesRecord.paymentNote || null,
      createdBy: salesRecord.createdBy?.fullName ?? null,
      createdAt: salesRecord.createdAt.toISOString(),
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching sales record:", error);
    return NextResponse.json({ error: "Failed to fetch sales record" }, { status: 500 });
  }
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthAdmin();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { userId } = auth;

    const { id } = await params;

    const existingRecord = await prisma.salesRecord.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!existingRecord) {
      return NextResponse.json({ error: "Sales record not found" }, { status: 404 });
    }

    const body = await request.json();
    const { quantitySold, sellingPrice, discount, remarks } = body;

    if (quantitySold == null || sellingPrice == null) {
      return NextResponse.json(
        { error: "Missing required fields: quantitySold and sellingPrice" },
        { status: 400 }
      );
    }

    if (
      discount !== undefined &&
      (isNaN(parseFloat(discount)) || parseFloat(discount) < 0 || parseFloat(discount) > 100)
    ) {
      return NextResponse.json({ error: "Discount must be between 0 and 100." }, { status: 400 });
    }

    const parsedQuantity = parseFloat(quantitySold);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0 || !Number.isInteger(parsedQuantity)) {
      return NextResponse.json({ error: "Quantity must be a whole number." }, { status: 400 });
    }

    const parsedSellingPrice = parseFloat(sellingPrice);
    if (isNaN(parsedSellingPrice) || parsedSellingPrice < 0) {
      return NextResponse.json(
        { error: "Selling price must be a valid number (0 or positive)." },
        { status: 400 }
      );
    }

    const quantityDifference = parsedQuantity - existingRecord.quantitySold;
    if (quantityDifference > 0) {
      const availablePackets = existingRecord.product.availableInventory || 0;
      if (quantityDifference > availablePackets) {
        return NextResponse.json(
          { error: `Insufficient stock. Available: ${availablePackets} packets, Additional needed: ${quantityDifference} packets` },
          { status: 400 }
        );
      }
    }

    const isFreeProduct = parsedSellingPrice === 0;
    const finalDiscount = isFreeProduct ? 0 : parseFloat(discount || "0");

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.salesRecord.update({
        where: { id },
        data: {
          quantitySold: parsedQuantity,
          sellingPrice: parsedSellingPrice,
          discount: finalDiscount,
          remarks: remarks || null,
          productionCost: existingRecord.productionCost
            ? (existingRecord.productionCost / existingRecord.quantitySold) * parsedQuantity
            : undefined,
          profit: isFreeProduct
            ? 0
            : existingRecord.productionCost
              ? parsedQuantity * parsedSellingPrice * (1 - finalDiscount / 100) -
                (existingRecord.productionCost / existingRecord.quantitySold) * parsedQuantity
              : parsedQuantity * parsedSellingPrice * (1 - finalDiscount / 100),
        },
        include: {
          product: { include: { formulation: true } },
          createdBy: { select: { fullName: true } },
        },
      });

      await tx.finishedProduct.update({
        where: { id: existingRecord.productId },
        data: {
          availableInventory: (existingRecord.product.availableInventory || 0) - quantityDifference,
        },
      });

      return updated;
    });

    // Build audit entries
    const changeEntries: Array<{ field: string; oldValue: any; newValue: any }> = [];
    if (existingRecord.quantitySold !== parsedQuantity) {
      changeEntries.push({ field: "quantitySold", oldValue: existingRecord.quantitySold, newValue: parsedQuantity });
    }
    if (existingRecord.sellingPrice !== parsedSellingPrice) {
      changeEntries.push({ field: "sellingPrice", oldValue: existingRecord.sellingPrice, newValue: parsedSellingPrice });
    }
    if ((existingRecord.discount || 0) !== finalDiscount) {
      changeEntries.push({ field: "discount", oldValue: existingRecord.discount || 0, newValue: finalDiscount });
    }
    if ((existingRecord.remarks || "") !== (remarks || "")) {
      changeEntries.push({ field: "remarks", oldValue: existingRecord.remarks || null, newValue: remarks || null });
    }

    if (changeEntries.length > 0) {
      await writeAuditLog(id, userId, "edit", {
        productName: existingRecord.product?.name ?? "",
        clientName: existingRecord.clientName ?? "",
        saleDate: existingRecord.saleDate?.toISOString().split("T")[0] ?? "",
        changes: changeEntries,
      });
    }

    const gross = result.quantitySold * result.sellingPrice;
    const totalAmount = gross - gross * ((result.discount || 0) / 100);

    return NextResponse.json({
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
      totalAmount,
      productionCostPerUnit: result.productionCost ? result.productionCost / result.quantitySold : 0,
      productionCostTotal: result.productionCost || 0,
      profit: result.profit || 0,
      saleDate: result.saleDate.toISOString().split("T")[0],
      remarks: result.remarks,
      createdBy: result.createdBy?.fullName ?? null,
      createdAt: result.createdAt.toISOString(),
    }, { status: 200 });
  } catch (error) {
    console.error("Error updating sales record:", error);
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update sales record" }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthAdmin();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { userId } = auth;

    const { id } = await params;

    const existingRecord = await prisma.salesRecord.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!existingRecord) {
      return NextResponse.json({ error: "Sales record not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.salesRecord.delete({ where: { id } });
      await tx.finishedProduct.update({
        where: { id: existingRecord.productId },
        data: {
          availableInventory: (existingRecord.product.availableInventory || 0) + existingRecord.quantitySold,
        },
      });
    });

    await writeAuditLog(id, userId, "delete", {
      productName: existingRecord.product?.name ?? "",
      clientName: existingRecord.clientName ?? "",
      saleDate: existingRecord.saleDate?.toISOString().split("T")[0] ?? "",
      changes: [{ field: "record", oldValue: "existed", newValue: "deleted" }],
    });

    return NextResponse.json({ message: "Sales record deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting sales record:", error);
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete sales record" }, { status: 500 });
  }
}

// ─── PATCH (payment status) ───────────────────────────────────────────────────
// skipAuditLog: true is passed when called from group-level payment update
// to prevent duplicate per-record audit entries. The caller writes one
// group-level audit entry instead.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthAdmin();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { userId } = auth;

    const { id } = await params;

    const existingRecord = await prisma.salesRecord.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!existingRecord) {
      return NextResponse.json({ error: "Sales record not found" }, { status: 404 });
    }

    const body = await request.json();
    const { paymentStatus, amountPaid, amountDue, paymentNote, skipAuditLog } = body;

    if (!paymentStatus || !["paid", "unpaid", "partial"].includes(paymentStatus)) {
      return NextResponse.json(
        { error: "Invalid payment status. Must be paid, unpaid, or partial." },
        { status: 400 }
      );
    }

    const updatedRecord = await prisma.salesRecord.update({
      where: { id },
      data: {
        paymentStatus,
        amountPaid: amountPaid !== undefined ? parseFloat(amountPaid) : undefined,
        amountDue: amountDue !== undefined ? parseFloat(amountDue) : undefined,
        paymentNote: paymentNote ?? null,
      },
    });

    // Only write per-record audit log when NOT part of a group payment update
    if (!skipAuditLog) {
      const paymentChanges: Array<{ field: string; oldValue: any; newValue: any }> = [];

      if ((existingRecord.paymentStatus || "paid") !== paymentStatus) {
        paymentChanges.push({
          field: "paymentStatus",
          oldValue: existingRecord.paymentStatus || "paid",
          newValue: paymentStatus,
        });
      }
      if (amountPaid !== undefined && (existingRecord.amountPaid ?? 0) !== parseFloat(amountPaid)) {
        paymentChanges.push({
          field: "amountPaid",
          oldValue: existingRecord.amountPaid ?? 0,
          newValue: parseFloat(amountPaid),
        });
      }

      if (paymentChanges.length > 0) {
        await writeAuditLog(id, userId, "payment", {
          productName: existingRecord.product?.name ?? "",
          clientName: existingRecord.clientName ?? "",
          saleDate: existingRecord.saleDate?.toISOString().split("T")[0] ?? "",
          changes: paymentChanges,
        });
      }
    }

    return NextResponse.json({ message: "Payment status updated", record: updatedRecord }, { status: 200 });
  } catch (error) {
    console.error("Error updating payment status:", error);
    return NextResponse.json({ error: "Failed to update payment status" }, { status: 500 });
  }
}