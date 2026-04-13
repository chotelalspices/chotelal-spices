import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET: Fetch all products for a formulation (with labels, quantities, and box types)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formulationId } = await params;

    const products = await prisma.finishedProduct.findMany({
      where: { formulationId },
      include: {
        productLabels: {
          include: {
            label: true,
            boxType: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedProducts = products.map((product) => ({
      ...product,
      labels: product.productLabels.map((pl) => ({
        type: pl.label.name,
        quantity: pl.quantity,
        semiPackageable: pl.semiPackageable,
        boxTypeId: pl.boxTypeId ?? null,
        boxTypeName: pl.boxType?.name ?? null,
      })),
      productLabels: undefined,
    }));

    return NextResponse.json(formattedProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

/**
 * POST: Create product with labels, quantities, semi-packageable flag, and box type
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formulationId } = await params;
    const body = await request.json();

    if (!body.name || !body.quantity || !body.unit) {
      return NextResponse.json(
        { error: 'Missing required fields: name, quantity, unit' },
        { status: 400 }
      );
    }

    const labels: Array<{
      type: string;
      quantity: number;
      boxTypeId?: string | null;
      semiPackageable?: boolean;
    }> = body.labels || [];

    const invalidLabels = labels.filter(
      (label) => !label.type || label.quantity <= 0
    );
    if (invalidLabels.length > 0) {
      return NextResponse.json(
        { error: 'All labels must have a type and quantity greater than 0' },
        { status: 400 }
      );
    }

    // Validate boxTypeIds if provided
    const boxTypeIds = labels
      .map((l) => l.boxTypeId)
      .filter((id): id is string => !!id);

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

    const product = await prisma.finishedProduct.create({
      data: {
        name: body.name,
        quantity: body.quantity,
        unit: body.unit,
        formulationId,
        productLabels: {
          create: await Promise.all(labels.map(async (label) => {
            const trimmedLabelType = label.type.trim();
            
            // First, try to find existing label with case-insensitive search
            const existingLabel = await prisma.label.findFirst({
              where: {
                name: {
                  equals: trimmedLabelType,
                  mode: 'insensitive'
                }
              }
            });

            return {
              quantity: label.quantity,
              semiPackageable: label.semiPackageable ?? false,
              // Connect boxType if provided
              ...(label.boxTypeId
                ? { boxType: { connect: { id: label.boxTypeId } } }
                : {}),
              label: existingLabel ? {
                connect: { id: existingLabel.id }
              } : {
                create: { name: trimmedLabelType } // Preserve original case
              }
            };
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

    return NextResponse.json(
      {
        ...product,
        labels: product.productLabels.map((pl) => ({
          type: pl.label.name,
          quantity: pl.quantity,
          semiPackageable: pl.semiPackageable,
          boxTypeId: pl.boxTypeId ?? null,
          boxTypeName: pl.boxType?.name ?? null,
        })),
        productLabels: undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}