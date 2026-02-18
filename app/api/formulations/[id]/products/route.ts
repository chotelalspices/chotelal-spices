import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET: Fetch all products for a formulation (with labels)
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
        labels: {
          include: {
            label: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Flatten labels for frontend
    const formattedProducts = products.map((product) => ({
      ...product,
      labels: product.labels.map((pl) => pl.label.name),
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
 * POST: Create product with labels
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formulationId } = await params;
    const body = await request.json();

    const labels: string[] = body.labels
      ? body.labels
          .split(',')
          .map((l: string) => l.trim().toLowerCase())
          .filter(Boolean)
      : [];

    const product = await prisma.finishedProduct.create({
      data: {
        name: body.name,
        quantity: body.quantity,
        unit: body.unit,
        formulationId,

        labels: {
          create: labels.map((labelName) => ({
            label: {
              connectOrCreate: {
                where: { name: labelName },
                create: { name: labelName },
              },
            },
          })),
        },
      },
      include: {
        labels: {
          include: {
            label: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        ...product,
        labels: product.labels.map((l) => l.label.name),
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
