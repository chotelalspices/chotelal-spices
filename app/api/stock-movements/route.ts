export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get('materialId');
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build where clause for filtering
    const where: any = {};

    if (materialId && materialId !== 'all') {
      where.rawMaterialId = materialId;
    }

    if (type && type !== 'all') {
      if (type === 'adjustment') {
        where.reason = {
          not: 'production'
        };
      } else if (type === 'production') {
        where.reason = 'production';
      }
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

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
        createdAt: 'desc',
      },
    });

    // Transform data to match the expected interface
    const transformedMovements = stockMovements.map((movement) => {
      return {
        id: movement.id,
        rawMaterialId: movement.rawMaterialId,
        rawMaterialName: movement.rawMaterial.name,
        action: movement.action.toLowerCase() as 'add' | 'reduce',
        quantity: movement.quantity,
        reason: movement.reason.toLowerCase() as 'purchase' | 'wastage' | 'damage' | 'correction' | 'production',
        reference: movement.reference || undefined,
        performedBy: movement.performedBy.fullName,
        createdAt: movement.createdAt.toISOString(),
      };
    });

    return NextResponse.json(transformedMovements, { status: 200 });
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock movements' },
      { status: 500 }
    );
  }
}
