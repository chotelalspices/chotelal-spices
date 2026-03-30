import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

/**
 * GET: Fetch single product with labels + boxType
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;

    const product = await prisma.finishedProduct.findUnique({
      where: { id: productId },
      include: {
        productLabels: {
          include: {
            label: true,
            // ── FIX 1: include boxType so it's returned to the edit page ──
            boxType: { select: { id: true, name: true } },
          },
        },
        formulation: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: product.id,
      name: product.name,
      quantity: product.quantity,
      unit: product.unit,
      formulationId: product.formulationId,
      createdAt: product.createdAt.toISOString(),
      labels: product.productLabels.map((pl) => ({
        type: pl.label.name,
        quantity: pl.quantity,
        semiPackageable: pl.semiPackageable,
        // ── FIX 2: return boxTypeId and boxTypeName so edit page can pre-fill ──
        boxTypeId: pl.boxTypeId ?? null,
        boxTypeName: pl.boxType?.name ?? null,
      })),
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

/**
 * PUT: Update product with labels + boxTypeId
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId } = await params;
    const body = await request.json();

    if (!body.name || !body.quantity || !body.unit) {
      return NextResponse.json(
        { error: 'Missing required fields: name, quantity, unit' },
        { status: 400 }
      );
    }

    // ── FIX 3: type now includes boxTypeId ────────────────────────────────
    const labels: Array<{
      type: string;
      quantity: number;
      semiPackageable: boolean;
      boxTypeId?: string | null;
    }> = body.labels || [];

    const invalidLabels = labels.filter((label) => !label.type || label.quantity <= 0);
    if (invalidLabels.length > 0) {
      return NextResponse.json(
        { error: 'All labels must have a type and quantity greater than 0' },
        { status: 400 }
      );
    }

    // Validate any provided boxTypeIds exist in DB
    const boxTypeIds = labels.map((l) => l.boxTypeId).filter((id): id is string => !!id);
    if (boxTypeIds.length > 0) {
      const foundBoxTypes = await (prisma as any).boxType.findMany({
        where: { id: { in: boxTypeIds } },
        select: { id: true },
      });
      const foundIds = new Set(foundBoxTypes.map((b: any) => b.id));
      const missingId = boxTypeIds.find((id) => !foundIds.has(id));
      if (missingId) {
        return NextResponse.json(
          { error: `Box type with ID "${missingId}" not found.` },
          { status: 404 }
        );
      }
    }

    const existingProduct = await prisma.finishedProduct.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
      // Delete old labels first
      await tx.productLabel.deleteMany({ where: { productId } });

      // Recreate with boxTypeId
      const product = await tx.finishedProduct.update({
        where: { id: productId },
        data: {
          name: body.name,
          quantity: body.quantity,
          unit: body.unit,
          productLabels: {
            create: labels.map((label) => ({
              quantity: label.quantity,
              semiPackageable: label.semiPackageable || false,
              // ── FIX 4: connect boxType when provided, same pattern as POST ──
              ...(label.boxTypeId
                ? { boxType: { connect: { id: label.boxTypeId } } }
                : {}),
              label: {
                connectOrCreate: {
                  where: { name: label.type.toLowerCase().trim() },
                  create: { name: label.type.toLowerCase().trim() },
                },
              },
            })),
          },
        },
        include: {
          productLabels: {
            include: {
              label: true,
              boxType: { select: { id: true, name: true } },
            },
          },
        },
      });

      return product;
    });

    return NextResponse.json(
      {
        ...updatedProduct,
        labels: updatedProduct.productLabels.map((pl) => ({
          type: pl.label.name,
          quantity: pl.quantity,
          semiPackageable: pl.semiPackageable,
          boxTypeId: pl.boxTypeId ?? null,
          boxTypeName: pl.boxType?.name ?? null,
        })),
        productLabels: undefined,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

/**
 * DELETE: Delete product
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId } = await params;

    const product = await prisma.finishedProduct.findUnique({ where: { id: productId } });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    await prisma.finishedProduct.delete({ where: { id: productId } });

    return NextResponse.json({ message: 'Product deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}