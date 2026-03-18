export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const id = (session.user as any).id as string;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.status !== 'active') return null;
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const label = await prisma.label.findUnique({
      where: { id },
      include: { labelMovements: { orderBy: { createdAt: 'asc' } } },
    });

    if (!label) return NextResponse.json({ error: 'Label not found' }, { status: 404 });

    const availableStock = label.labelMovements.reduce((total, m) =>
      m.action === 'add' ? total + m.quantity : total - m.quantity, 0);

    return NextResponse.json({
      id: label.id,
      name: label.name,
      availableStock,
      minimumStock: label.minimumStock,
      costPerUnit: label.costPerUnit ?? 0,
      status: label.status.toLowerCase() as 'active' | 'inactive',
      description: label.description || undefined,
      createdAt: label.createdAt.toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch label' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { name, minimumStockLevel, costPerUnit, status, description } = await request.json();

    if (!name || minimumStockLevel === undefined || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await prisma.label.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Label not found' }, { status: 404 });

    const updated = await prisma.label.update({
      where: { id },
      data: {
        name: name.trim(),
        minimumStock: parseInt(minimumStockLevel),
        costPerUnit: parseFloat(costPerUnit) || 0,
        status: status.toLowerCase() as 'active' | 'inactive',
        description: description?.trim() || null,
      },
      include: { labelMovements: { orderBy: { createdAt: 'asc' } } },
    });

    const availableStock = updated.labelMovements.reduce((total, m) =>
      m.action === 'add' ? total + m.quantity : total - m.quantity, 0);

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      availableStock,
      minimumStock: updated.minimumStock,
      costPerUnit: updated.costPerUnit ?? 0,
      status: updated.status.toLowerCase(),
      description: updated.description || undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'A label with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update label' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.label.findUnique({
      where: { id },
      include: { productLabels: true },
    });

    if (!existing) return NextResponse.json({ error: 'Label not found' }, { status: 404 });

    if (existing.productLabels.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete label. It is assigned to finished products.' },
        { status: 409 }
      );
    }

    await prisma.labelMovement.deleteMany({ where: { labelId: id } });
    await prisma.label.delete({ where: { id } });

    return NextResponse.json({ message: 'Label deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete label' }, { status: 500 });
  }
}