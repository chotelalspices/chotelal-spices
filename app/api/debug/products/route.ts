import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const products = await prisma.finishedProduct.findMany({
      select: {
        id: true,
        name: true,
        quantity: true,
        availableInventory: true,
        formulationId: true,
        createdAt: true,
      }
    });

    console.log('Debug - All products:', products);
    
    return NextResponse.json({
      count: products.length,
      products: products
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
