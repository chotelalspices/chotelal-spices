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
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform products to include available inventory and extract container info from name
    const transformedProducts = products.map((product) => {
      // Extract container size from product name (e.g., "Garam Masala 100g" -> 100g)
      const nameParts = product.name.split(' ');
      const containerLabel = nameParts[nameParts.length - 1]; // e.g., "100g" or "1kg"
      
      let containerSize = 0;
      if (containerLabel.toLowerCase().includes('kg')) {
        // For kg sizes, convert to grams for consistency
        const sizeInKg = parseFloat(containerLabel.replace(/[^\d.]/g, '')) || 0;
        containerSize = sizeInKg * 1000; // Convert kg to grams
      } else if (containerLabel.toLowerCase().includes('g')) {
        // For gram sizes, use directly
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
        containerSize, // in grams
        createdAt: product.createdAt,
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
