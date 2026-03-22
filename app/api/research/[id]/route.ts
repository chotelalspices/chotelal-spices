import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { email: session.user?.email || '' },
      include: { userRoles: { select: { role: true } } },
    });
    const isAdmin = user?.userRoles.some((r) => r.role === 'admin') ?? false;

    const research = await prisma.researchFormulation.findUnique({
      where: { id },
      include: {
        ingredients: { include: { rawMaterial: true } },
        extendedItems: {
          include: { extendedInventory: true },
        },
        reviewedBy: { select: { fullName: true } },
      },
    });

    if (!research) {
      return NextResponse.json({ error: 'Research formulation not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...research,
      extendedItems: research.extendedItems.map((item) => ({
        id: item.id,
        extendedInventoryId: item.extendedInventoryId,
        productName: item.extendedInventory.productName,
        code: item.extendedInventory.code || null,
        price: item.extendedInventory.price,
        companyName: isAdmin ? item.extendedInventory.companyName : null,
        quantity: (item as any).quantity ?? 0,
        percentage: (item as any).percentage ?? 0,
        notes: item.notes || null,
      })),
    });
  } catch (error) {
    console.error('Error fetching research formulation:', error);
    return NextResponse.json({ error: 'Failed to fetch research formulation' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const {
      tempName, researcherName, researchDate,
      baseQuantity, baseUnit, notes, ingredients, extendedItems,
    } = body;

    if (ingredients) {
      const totalPercentage = ingredients.reduce(
        (sum: number, ing: any) => sum + (ing.percentage || 0), 0
      );
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return NextResponse.json(
          { error: 'Ingredient percentages must total 100%' },
          { status: 400 }
        );
      }
    }

    const validExtendedItems = Array.isArray(extendedItems)
      ? extendedItems.filter((item: any) => item.extendedInventoryId)
      : [];

    const research = await prisma.researchFormulation.update({
      where: { id },
      data: {
        ...(tempName && { tempName }),
        ...(researcherName && { researcher: researcherName }),
        ...(researchDate && { researchDate: new Date(researchDate) }),
        ...(baseQuantity && { baseQuantity: parseFloat(baseQuantity) }),
        ...(baseUnit && { baseUnit }),
        ...(notes !== undefined && { notes }),
        ...(ingredients && {
          ingredients: {
            deleteMany: { researchId: id },
            create: ingredients.map((ing: any) => ({
              rawMaterialId: ing.rawMaterialId,
              percentage: parseFloat(ing.percentage),
            })),
          },
        }),
        extendedItems: {
          deleteMany: { researchId: id },
          ...(validExtendedItems.length > 0 && {
            create: validExtendedItems.map((item: any) => ({
              extendedInventoryId: item.extendedInventoryId,
              quantity: parseFloat(item.quantity) || 0,
              percentage: parseFloat(item.percentage) || 0,
              notes: item.notes || null,
            })),
          }),
        },
      },
    });

    return NextResponse.json(research);
  } catch (error) {
    console.error('Error updating research formulation:', error);
    return NextResponse.json({ error: 'Failed to update research formulation' }, { status: 500 });
  }
}

// ── DELETE — admin can delete any; researcher can delete their own pending/rejected ──
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { email: session.user?.email || '' },
      include: { userRoles: { select: { role: true } } },
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });
    if (user.status !== 'active') return NextResponse.json({ error: 'Account inactive' }, { status: 403 });

    const roles = user.userRoles.map((r) => r.role);
    const isAdmin = roles.includes('admin');
    const isResearcher = roles.includes('research');

    if (!isAdmin && !isResearcher) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const research = await prisma.researchFormulation.findUnique({ where: { id } });
    if (!research) return NextResponse.json({ error: 'Research not found' }, { status: 404 });

    // Researcher can only delete their own non-approved items
    if (!isAdmin) {
      if (research.researcher !== user.fullName) {
        return NextResponse.json({ error: 'You can only delete your own research' }, { status: 403 });
      }
      if (research.status === 'approved') {
        return NextResponse.json({ error: 'Approved research cannot be deleted' }, { status: 403 });
      }
    }

    await prisma.$transaction([
  prisma.researchIngredient.deleteMany({ where: { researchId: id } }),
  (prisma as any).researchExtendedItem.deleteMany({ where: { researchId: id } }),
  prisma.researchFormulation.delete({ where: { id } }),
]);
    return NextResponse.json({ message: 'Deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting research formulation:', error);
    return NextResponse.json({ error: 'Failed to delete research formulation' }, { status: 500 });
  }
}