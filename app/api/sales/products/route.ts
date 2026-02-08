export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to perform this action." },
        { status: 401 }
      );
    }

    // Get the authenticated user's ID
    const authenticatedUserId = (session.user as any).id as string;

    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: "User ID not found in session." },
        { status: 401 }
      );
    }

    // Verify the user exists and is active in the database
    const user = await prisma.user.findUnique({
      where: { id: authenticatedUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found in database." },
        { status: 401 }
      );
    }

    if (user.status !== "active") {
      return NextResponse.json(
        {
          error:
            "Your account is not active. Please contact an administrator.",
        },
        { status: 403 }
      );
    }

    // Fetch all finished products with their relations
    const finishedProducts = await prisma.finishedProduct.findMany({
      include: {
        formulation: {
          include: {
            productionBatches: {
              include: {
                materialUsages: {
                  include: {
                    rawMaterial: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log('Found finished products:', finishedProducts.length);
    console.log('Sample product:', finishedProducts[0]);

    
    // Process finished products to calculate available quantities and costs
    const availableProducts = finishedProducts.map((product) => {
      const availableQuantity = product.availableInventory || 0;

      // Calculate production cost per packet
      let productionCostPerPacket = 0;
      
      // Get the most recent batch for this formulation to calculate cost
      const recentBatch = product.formulation.productionBatches
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      if (recentBatch && recentBatch.materialUsages.length > 0) {
        const totalProductionCost = recentBatch.materialUsages.reduce(
          (sum: number, usage: any) => sum + usage.cost,
          0
        );
        
        const finalOutputKg =
          recentBatch.unit === "kg"
            ? (recentBatch.finalOutput ?? recentBatch.plannedQuantity)
            : (recentBatch.finalOutput ?? recentBatch.plannedQuantity) / 1000;
        
        if (finalOutputKg > 0) {
          const productionCostPerKg = totalProductionCost / finalOutputKg;
          
          // Use the product's actual quantity and unit instead of parsing the name
          let weightPerPacketKg = 0;
          
          if (product.unit === "kg") {
            weightPerPacketKg = product.quantity;
          } else if (product.unit === "gm") {
            weightPerPacketKg = product.quantity / 1000;
          }
          
          productionCostPerPacket = productionCostPerKg * weightPerPacketKg;
        }
      }

      // Use product's actual quantity and unit for container info
      let containerSize = 0;
      let containerLabel = '';
      
      if (product.unit === "kg") {
        containerSize = product.quantity * 1000; // Convert kg to grams for consistency
        containerLabel = `${product.quantity}kg`;
      } else if (product.unit === "gm") {
        containerSize = product.quantity; // Use grams directly
        containerLabel = `${product.quantity}g`;
      }

      return {
        id: product.id,
        name: product.name,
        formulationId: product.formulationId,
        formulationName: product.formulation.name,
        batchId: null, // Not applicable for finished products
        batchNumber: null, // Not applicable for finished products
        createdAt: product.createdAt.toISOString(),
        availableQuantity,
        unit: "packets" as const,
        productionCostPerPacket,
        containerSize,
        containerLabel,
        formulation: {
          name: product.formulation.name,
          baseQuantity: product.formulation.baseQuantity,
          baseUnit: product.formulation.baseUnit,
          status: product.formulation.status
        },
        batches: [], // Can be populated if needed from formulation batches
      };
    })
    // Temporarily show all products to debug - remove this filter if you want to filter by available inventory
    // .filter((product) => (product.availableQuantity || 0) > 0)
    .sort((a, b) => {
      // Sort alphabetically and numerically by product name
      // This will handle names like "Chaat Masala 100g", "Chaat Masala 200g", "Garam Masala 100g"
      const aParts = a.name.split(' ');
      const bParts = b.name.split(' ');
      
      // Get the formulation name (everything except the last part which is the quantity)
      const aFormulation = aParts.slice(0, -1).join(' ');
      const bFormulation = bParts.slice(0, -1).join(' ');
      
      // Get the quantity (last part)
      const aQuantity = aParts[aParts.length - 1];
      const bQuantity = bParts[bParts.length - 1];
      
      // First sort by formulation name alphabetically
      if (aFormulation.toLowerCase() < bFormulation.toLowerCase()) return -1;
      if (aFormulation.toLowerCase() > bFormulation.toLowerCase()) return 1;
      
      // If formulation names are the same, sort by quantity numerically
      // Extract numeric value from quantity strings like "100g", "200g", "50g"
      const aNum = parseInt(aQuantity.replace(/\D/g, ''));
      const bNum = parseInt(bQuantity.replace(/\D/g, ''));
      
      return aNum - bNum;
    });

    console.log('Processed products count:', availableProducts.length);
    console.log('Sample processed product:', availableProducts[0]);

    return NextResponse.json(availableProducts, { status: 200 });
  } catch (error) {
    console.error("Error fetching finished products:", error);
    return NextResponse.json(
      { error: "Failed to fetch finished products" },
      { status: 500 }
    );
  }
}
