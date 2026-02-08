export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Build where clause for filtering
    const where: any = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }

    const rawMaterials = await prisma.rawMaterial.findMany({
      where,
      select: {
        id: true,
        name: true,
        unit: true,
        status: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transform data to match the expected interface
    const transformedMaterials = rawMaterials.map((material) => ({
      id: material.id,
      name: material.name,
      unit: material.unit.toLowerCase() as 'kg' | 'gm',
      status: material.status.toLowerCase() as 'active' | 'inactive',
    }));

    return NextResponse.json(transformedMaterials, { status: 200 });
  } catch (error) {
    console.error('Error fetching raw materials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch raw materials' },
      { status: 500 }
    );
  }
}
