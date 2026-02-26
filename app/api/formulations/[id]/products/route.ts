import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET: Fetch all products for a formulation (with labels and quantities)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formulationId } = await params;

    const products = await prisma.finishedProduct.findMany({
      where: {
        formulationId,
      },
      include: {
        productLabels: {
          include: {
            label: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format labels with quantities for frontend
    const formattedProducts = products.map((product) => ({
      ...product,
      labels: product.productLabels.map((pl) => ({
        type: pl.label.name,
        quantity: pl.quantity,
      })),
      productLabels: undefined, // Remove raw relation data
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
 * POST: Create product with labels and quantities
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formulationId } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.quantity || !body.unit) {
      return NextResponse.json(
        { error: 'Missing required fields: name, quantity, unit' },
        { status: 400 }
      );
    }

    // Parse labels array
    const labels: Array<{ type: string; quantity: number }> = body.labels || [];

    // Validate label quantities
    const invalidLabels = labels.filter(
      (label) => !label.type || label.quantity <= 0
    );
    if (invalidLabels.length > 0) {
      return NextResponse.json(
        { error: 'All labels must have a type and quantity greater than 0' },
        { status: 400 }
      );
    }

    // Create product with labels
    const product = await prisma.finishedProduct.create({
      data: {
        name: body.name,
        quantity: body.quantity,
        unit: body.unit,
        formulationId,

        productLabels: {
          create: labels.map((label) => ({
            quantity: label.quantity,
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