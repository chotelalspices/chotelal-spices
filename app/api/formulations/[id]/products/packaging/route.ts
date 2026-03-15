import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: formulationId } = await params;

    const products = await prisma.finishedProduct.findMany({
      where: {
        formulationId: formulationId,
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

    const transformedProducts = products.map((product) => {
      const nameParts = product.name.split(' ');
      const containerLabel = nameParts[nameParts.length - 1];

      let containerSize = 0;
      if (containerLabel.toLowerCase().includes('kg')) {
        const sizeInKg = parseFloat(containerLabel.replace(/[^\d.]/g, '')) || 0;
        containerSize = sizeInKg * 1000;
      } else if (containerLabel.toLowerCase().includes('g')) {
        containerSize = parseFloat(containerLabel.replace(/[^\d.]/g, '')) || 0;
      }

      return {
        id: product.id,
        name: product.name,
        formulationId: product.formulationId,
        quantity: product.quantity,
        availableInventory: product.availableInventory || 0,
        unit: product.unit,
        containerLabel,
        containerSize,
        createdAt: product.createdAt,
        labels: product.productLabels.map((pl) => ({
          type: pl.label.name,
          quantity: pl.quantity, // qty per courier box
          semiPackageable: pl.semiPackageable,
        })),
      };
    });

    return NextResponse.json(transformedProducts);
  } catch (error) {
    console.error('Error fetching formulation products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch formulation products' },
      { status: 500 }
    );
  }
}