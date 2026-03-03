export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const labelId = searchParams.get('labelId');
    const reason = searchParams.get('reason');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: any = {};
    if (labelId) where.labelId = labelId;
    if (reason) where.reason = reason;
    if (dateFrom || dateTo) {
      where.adjustmentDate = {};
      if (dateFrom) where.adjustmentDate.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.adjustmentDate.lte = end;
      }
    }

    const movements = await prisma.labelMovement.findMany({
      where,
      include: {
        label: { select: { name: true } },
        performedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = movements.map((m) => ({
      id: m.id,
      labelId: m.labelId,
      labelName: m.label.name,
      action: m.action,
      quantity: m.quantity,
      reason: m.reason,
      remarks: m.remarks || undefined,
      adjustmentDate: m.adjustmentDate.toISOString(),
      createdAt: m.createdAt.toISOString(),
      performedBy: m.performedBy?.fullName || undefined,
    }));

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error fetching label movements:', error);
    return NextResponse.json({ error: 'Failed to fetch label movements' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authenticatedUserId = (session.user as any).id as string;
    const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
    if (!user || user.status !== 'active') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { labelId, adjustmentType, quantity, reason, adjustmentDate, remarks } = await request.json();

    if (!labelId || !quantity || !reason || !adjustmentType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const label = await prisma.label.findUnique({
      where: { id: labelId },
      include: { labelMovements: true },
    });

    if (!label) return NextResponse.json({ error: 'Label not found' }, { status: 404 });

    // Check stock won't go negative on reduce
    if (adjustmentType === 'reduce') {
      const currentStock = label.labelMovements.reduce((total, m) =>
        m.action === 'add' ? total + m.quantity : total - m.quantity, 0);
      if (currentStock - parseInt(quantity) < 0) {
        return NextResponse.json(
          { error: 'Insufficient stock. Cannot reduce below zero.' },
          { status: 400 }
        );
      }
    }

    const movement = await prisma.labelMovement.create({
      data: {
        labelId,
        action: adjustmentType,
        quantity: parseInt(quantity),
        reason,
        remarks: remarks?.trim() || null,
        adjustmentDate: adjustmentDate ? new Date(adjustmentDate) : new Date(),
        performedById: authenticatedUserId,
      },
      include: {
        label: { select: { name: true } },
        performedBy: { select: { fullName: true } },
      },
    });

    return NextResponse.json({
      id: movement.id,
      labelId: movement.labelId,
      labelName: movement.label.name,
      action: movement.action,
      quantity: movement.quantity,
      reason: movement.reason,
      remarks: movement.remarks || undefined,
      adjustmentDate: movement.adjustmentDate.toISOString(),
      createdAt: movement.createdAt.toISOString(),
      performedBy: movement.performedBy?.fullName || undefined,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating label movement:', error);
    return NextResponse.json({ error: 'Failed to create label movement' }, { status: 500 });
  }
}