export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET() {
  try {
    const labels = await prisma.label.findMany({
      include: {
        labelMovements: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = labels.map((label) => {
      const availableStock = label.labelMovements.reduce((total, m) =>
        m.action === 'add' ? total + m.quantity : total - m.quantity, 0);
      return {
        id: label.id,
        name: label.name,
        availableStock,
        minimumStock: label.minimumStock,
        status: label.status.toLowerCase() as 'active' | 'inactive',
        description: label.description || undefined,
        createdAt: label.createdAt.toISOString(),
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error fetching labels:', error);
    return NextResponse.json({ error: 'Failed to fetch labels' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authenticatedUserId = (session.user as any).id as string;
    const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });
    if (user.status !== 'active') return NextResponse.json({ error: 'Account not active' }, { status: 403 });

    const { name, openingStock, minimumStock, status, description } = await request.json();

    if (!name || minimumStock === undefined || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const label = await tx.label.create({
        data: {
          name: name.trim(),
          minimumStock: parseInt(minimumStock),
          status: status.toLowerCase() as 'active' | 'inactive',
          description: description?.trim() || null,
        },
      });

      if (openingStock && openingStock > 0) {
        await tx.labelMovement.create({
          data: {
            labelId: label.id,
            action: 'add',
            quantity: parseInt(openingStock),
            reason: 'purchase',
            performedById: authenticatedUserId,
          },
        });
      }
      return label;
    });

    const created = await prisma.label.findUnique({
      where: { id: result.id },
      include: { labelMovements: { orderBy: { createdAt: 'asc' } } },
    });

    const availableStock = created!.labelMovements.reduce((total, m) =>
      m.action === 'add' ? total + m.quantity : total - m.quantity, 0);

    return NextResponse.json({
      id: created!.id, name: created!.name, availableStock,
      minimumStock: created!.minimumStock,
      status: created!.status.toLowerCase(),
      description: created!.description || undefined,
      createdAt: created!.createdAt.toISOString(),
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating label:', error);
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'A label with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create label' }, { status: 500 });
  }
}