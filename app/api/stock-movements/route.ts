export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const materialId = searchParams.get("materialId");
    const reason = searchParams.get("reason"); // ✅ changed
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // ============================
    // Build WHERE clause
    // ============================
    const where: any = {};

    // Material filter
    if (materialId && materialId !== "all") {
      where.rawMaterialId = materialId;
    }

    // Reason filter (direct column filtering)
    if (reason && reason !== "all") {
      where.reason = reason;
    }

    // Date filtering
    if (dateFrom || dateTo) {
      where.createdAt = {};

      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999); // include full day
        where.createdAt.lte = toDate;
      }
    }

    // ============================
    // Fetch from DB
    // ============================
    const stockMovements = await prisma.stockMovement.findMany({
      where,
      include: {
        rawMaterial: {
          select: {
            id: true,
            name: true,
            unit: true,
          },
        },
        performedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // ============================
    // Transform response
    // ============================
    const transformedMovements = stockMovements.map((movement) => ({
      id: movement.id,
      rawMaterialId: movement.rawMaterialId,
      rawMaterialName: movement.rawMaterial.name,
      action: movement.action.toLowerCase() as "add" | "reduce",
      quantity: movement.quantity,
      reason: movement.reason.toLowerCase() as
        | "purchase"
        | "wastage"
        | "damage"
        | "correction"
        | "production",
      reference: movement.reference || undefined,
      performedBy: movement.performedBy ? movement.performedBy.fullName : undefined,
      createdAt: movement.createdAt.toISOString(),
    }));

    return NextResponse.json(transformedMovements, { status: 200 });

  } catch (error) {
    console.error("Error fetching stock movements:", error);

    return NextResponse.json(
      { error: "Failed to fetch stock movements" },
      { status: 500 }
    );
  }
}