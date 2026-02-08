export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { batchNumber, date, items, packagingLoss, remarks } = body;

    // Validate required fields
    if (!batchNumber || !date || !items || !Array.isArray(items)) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: batchNumber, date, and items are required",
        },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "At least one packaged item is required" },
        { status: 400 }
      );
    }

    // Find the production batch by batch number (primary) or id (fallback)
    let batch = await prisma.productionBatch.findUnique({
      where: { batchNumber },
    });

    if (!batch) {
      batch = await prisma.productionBatch.findUnique({
        where: { id: batchNumber },
      });
    }

    if (!batch) {
      return NextResponse.json(
        { error: "Production batch not found" },
        { status: 404 }
      );
    }

    console.log('Received items:', items); // Debug log
    console.log('Product IDs from items:', items.map((item: any) => item.containerId)); // Debug log

    // Validate products exist
    const productIds = items.map((item: any) => item.containerId);
    const products = await prisma.finishedProduct.findMany({
      where: {
        id: {
          in: productIds,
        },
      },
    });

    console.log('Found products:', products); // Debug log

    if (products.length !== productIds.length) {
      console.log('Product validation failed. Found:', products.length, 'Expected:', productIds.length); // Debug log
      return NextResponse.json(
        { error: "One or more products not found" },
        { status: 404 }
      );
    }

    // Fetch batch with formulation to get product name
    const batchWithFormulation = await prisma.productionBatch.findUnique({
      where: { id: batch.id },
      include: {
        formulation: true,
      },
    });

    if (!batchWithFormulation) {
      return NextResponse.json(
        { error: "Batch not found" },
        { status: 404 }
      );
    }

    // Create packaging session and update product inventory
    const result = await prisma.$transaction(async (tx) => {
      // Create a new packaging session for each packaging operation
      const packagingSession = await tx.packagingSession.create({
        data: {
          batchId: batch?.id ?? "",
          date: new Date(date),
          packagingLoss: parseFloat(packagingLoss) || 0,
          remarks: remarks || null,
          performedById: authenticatedUserId,
        },
      });

      // Update product inventory and track packaging details
      let totalPackagedWeight = 0;
      let packagingDetails = [];
      
      for (const item of items) {
        console.log('Processing item:', item); // Debug log
        const product = products.find(p => p.id === item.containerId);
        console.log('Found product for item:', product); // Debug log
        
        if (product) {
          console.log(`Updating inventory for product ${product.name}: +${item.numberOfPackets}`); // Debug log
          console.log(`Current availableInventory: ${product.availableInventory}`); // Debug log
          
          // Update existing product inventory (increase available inventory)
          await tx.finishedProduct.update({
            where: { id: product.id },
            data: {
              availableInventory: (product.availableInventory || 0) + parseInt(item.numberOfPackets),
            },
          });
          console.log('Inventory updated successfully'); // Debug log
          
          // Track packaging details
          totalPackagedWeight += parseFloat(item.totalWeight);
          packagingDetails.push(`${product.name}: ${item.numberOfPackets} packets (${item.totalWeight}kg)`);
        } else {
          console.log('Product not found for containerId:', item.containerId); // Debug log
        }
      }

      // Update session remarks with packaging details
      if (packagingDetails.length > 0) {
        await tx.packagingSession.update({
          where: { id: packagingSession.id },
          data: {
            remarks: `${remarks || ''} Packaged: ${packagingDetails.join(', ')}. Total: ${totalPackagedWeight}kg`.trim(),
          },
        });
      }

      return { packagingSession };
    });

    // Fetch the created session
    const createdSession = await prisma.packagingSession.findUnique({
      where: { id: result.packagingSession.id },
      include: {
        performedBy: {
          select: {
            fullName: true,
          },
        },
        batch: {
          include: {
            formulation: true,
          },
        },
      },
    });

    if (!createdSession) {
      throw new Error("Failed to fetch created session");
    }

    // Calculate total packaged weight from remarks
    let totalPackagedWeight = 0;
    if (createdSession.remarks && createdSession.remarks.includes('Total:')) {
      const match = createdSession.remarks.match(/Total:\s*([\d.]+)kg/);
      if (match) {
        totalPackagedWeight = parseFloat(match[1]);
      }
    }

    return NextResponse.json(
      {
        id: createdSession.id,
        batchNumber: createdSession.batch?.batchNumber || '',
        date: createdSession.date.toISOString(),
        items: [], // No PackagedItem records
        packagingLoss: createdSession.packagingLoss,
        totalPackagedWeight: totalPackagedWeight,
        remarks: createdSession.remarks,
        performedBy: createdSession.performedBy.fullName,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating packaging session:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to create packaging session" },
      { status: 500 }
    );
  }
}
