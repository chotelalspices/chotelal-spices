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

    const authenticatedUserId = (session.user as any).id as string;

    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: "User ID not found in session." },
        { status: 401 }
      );
    }

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
        { error: "Your account is not active. Please contact an administrator." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { batchNumber, date, items, packagingLoss, remarks, courierBox, labels } = body;

    // Validate required fields
    if (!batchNumber || !date || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Missing required fields: batchNumber, date, and items are required" },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "At least one packaged item is required" },
        { status: 400 }
      );
    }

    // Validate courier box if provided
    if (courierBox) {
      if (!courierBox.itemsPerBox || courierBox.itemsPerBox <= 0) {
        return NextResponse.json(
          { error: "Courier box must have a valid itemsPerBox greater than 0" },
          { status: 400 }
        );
      }
      if (!courierBox.boxesNeeded || courierBox.boxesNeeded <= 0) {
        return NextResponse.json(
          { error: "Courier box must have a valid boxesNeeded greater than 0" },
          { status: 400 }
        );
      }
    }

    // Validate labels if provided
    const labelsArray: Array<{ type: string; quantity: number }> = Array.isArray(labels) ? labels : [];
    const invalidLabels = labelsArray.filter((l) => !l.type?.trim() || l.quantity <= 0);
    if (invalidLabels.length > 0) {
      return NextResponse.json(
        { error: "All labels must have a type and quantity greater than 0" },
        { status: 400 }
      );
    }

    // Find the production batch
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

    console.log('Received items:', items);
    console.log('Product IDs from items:', items.map((item: any) => item.containerId));
    console.log('Courier box data:', courierBox);
    console.log('Labels data:', labelsArray);

    // Validate products exist
    const productIds = items.map((item: any) => item.containerId);
    const products = await prisma.finishedProduct.findMany({
      where: { id: { in: productIds } },
    });

    console.log('Found products:', products);

    if (products.length !== productIds.length) {
      console.log('Product validation failed. Found:', products.length, 'Expected:', productIds.length);
      return NextResponse.json(
        { error: "One or more products not found" },
        { status: 404 }
      );
    }

    const batchWithFormulation = await prisma.productionBatch.findUnique({
      where: { id: batch.id },
      include: { formulation: true },
    });

    if (!batchWithFormulation) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Create packaging session, update inventory, store courier box and labels
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the packaging session
      const packagingSession = await tx.packagingSession.create({
        data: {
          batchId: batch?.id ?? "",
          date: new Date(date),
          packagingLoss: parseFloat(packagingLoss) || 0,
          remarks: remarks || null,
          performedById: authenticatedUserId,
        },
      });

      // 2. Update product inventory and build remarks
      let totalPackagedWeight = 0;
      const packagingDetails: string[] = [];

      for (const item of items) {
        console.log('Processing item:', item);
        const product = products.find((p) => p.id === item.containerId);
        console.log('Found product for item:', product);

        if (product) {
          console.log(`Updating inventory for product ${product.name}: +${item.numberOfPackets}`);
          console.log(`Current availableInventory: ${product.availableInventory}`);

          await tx.finishedProduct.update({
            where: { id: product.id },
            data: {
              availableInventory: (product.availableInventory || 0) + parseInt(item.numberOfPackets),
            },
          });

          console.log('Inventory updated successfully');

          totalPackagedWeight += parseFloat(item.totalWeight);
          packagingDetails.push(
            `${product.name}: ${item.numberOfPackets} packets (${item.totalWeight}kg)`
          );
        } else {
          console.log('Product not found for containerId:', item.containerId);
        }
      }

      // 3. Update session remarks with packaging details
      if (packagingDetails.length > 0) {
        await tx.packagingSession.update({
          where: { id: packagingSession.id },
          data: {
            remarks: `${remarks || ''} Packaged: ${packagingDetails.join(', ')}. Total: ${totalPackagedWeight}kg`.trim(),
          },
        });
      }

      // 4. Create courier box record if provided
      let courierBoxRecord = null;
      if (courierBox) {
        const totalPackets = items.reduce(
          (sum: number, item: any) => sum + parseInt(item.numberOfPackets),
          0
        );

        courierBoxRecord = await tx.courierBox.create({
          data: {
            sessionId: packagingSession.id,
            label: courierBox.label || 'Courier Box',
            itemsPerBox: courierBox.itemsPerBox,
            boxesNeeded: courierBox.boxesNeeded,
            totalPackets: courierBox.totalPackets ?? totalPackets,
          },
        });

        console.log('Courier box record created:', courierBoxRecord);
      }

      // 5. Create session label records if provided
      let labelRecords: any[] = [];
      if (labelsArray.length > 0) {
        labelRecords = await Promise.all(
          labelsArray.map((l) =>
            tx.sessionLabel.create({
              data: {
                sessionId: packagingSession.id,
                type: l.type.trim(),
                quantity: l.quantity,
              },
            })
          )
        );
        console.log('Session labels created:', labelRecords);
      }

      return { packagingSession, courierBoxRecord, labelRecords };
    });

    // Fetch the created session with all relations
    const createdSession = await prisma.packagingSession.findUnique({
      where: { id: result.packagingSession.id },
      include: {
        performedBy: {
          select: { fullName: true },
        },
        batch: {
          include: { formulation: true },
        },
        courierBoxes: true,
        sessionLabels: true,
      },
    });

    if (!createdSession) {
      throw new Error("Failed to fetch created session");
    }

    // Extract total packaged weight from remarks
    let totalPackagedWeight = 0;
    if (createdSession.remarks?.includes('Total:')) {
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
        items: [],
        packagingLoss: createdSession.packagingLoss,
        totalPackagedWeight,
        remarks: createdSession.remarks,
        performedBy: createdSession.performedBy.fullName,
        courierBox: createdSession.courierBoxes[0] ?? null,
        labels: createdSession.sessionLabels.map((l) => ({
          type: l.type,
          quantity: l.quantity,
        })),
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