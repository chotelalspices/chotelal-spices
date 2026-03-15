export const runtime = "nodejs";


import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchNumber: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized. Please log in to perform this action." }, { status: 401 });
    }
    const authenticatedUserId = (session.user as any).id as string;
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "User ID not found in session." }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
    if (!user) {
      return NextResponse.json({ error: "User not found in database." }, { status: 401 });
    }
    if (user.status !== "active") {
      return NextResponse.json({ error: "Your account is not active. Please contact an administrator." }, { status: 403 });
    }

    const { batchNumber } = await params as { batchNumber: string };
    const identifier = decodeURIComponent(batchNumber);

    const packagingSessionsInclude = {
      include: {
        items: { include: { container: true } },
        performedBy: { select: { fullName: true } },
        courierBoxes: true,
        sessionLabels: true,
      },
      orderBy: { date: "desc" as const },
    };

    let batch = await prisma.productionBatch.findUnique({
      where: { batchNumber: identifier },
      include: { formulation: true, packagingSessions: packagingSessionsInclude },
    });

    if (!batch) {
      batch = await prisma.productionBatch.findUnique({
        where: { id: identifier },
        include: { formulation: true, packagingSessions: packagingSessionsInclude },
      });
    }

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const totalPackagedWeight = batch.packagingSessions.reduce((sum, session) => {
      if (session.remarks && session.remarks.includes('Total:')) {
        const match = session.remarks.match(/Total:\s*([\d.]+)kg/);
        if (match) return sum + parseFloat(match[1]);
      }
      return sum;
    }, 0);

    const totalLoss = batch.packagingSessions.reduce((sum, session) => sum + session.packagingLoss, 0);

    const finalOutputKg =
      batch.unit === "kg"
        ? (batch.finalOutput ?? batch.plannedQuantity)
        : (batch.finalOutput ?? batch.plannedQuantity) / 1000;

    const remainingQuantity = finalOutputKg - totalPackagedWeight - totalLoss;

    let status: "Not Started" | "Partial" | "Completed";
    if (totalPackagedWeight === 0) {
      status = "Not Started";
    } else if (remainingQuantity <= 0.01) {
      status = "Completed";
    } else {
      status = "Partial";
    }

    const sessions = batch.packagingSessions.map((session) => {
      let sessionWeight = 0;
      if (session.remarks && session.remarks.includes('Total:')) {
        const match = session.remarks.match(/Total:\s*([\d.]+)kg/);
        if (match) sessionWeight = parseFloat(match[1]);
      }
      return {
        id: session.id,
        batchNumber: batch?.batchNumber,
        date: session.date.toISOString(),
        items: [],
        packagingLoss: session.packagingLoss,
        totalPackagedWeight: sessionWeight,
        semiPackaged: session.semiPackaged || 0,
        remarks: session.remarks,
        performedBy: session.performedBy ? session.performedBy.fullName : null,
        courierBoxes: session.courierBoxes ?? [],
        labels: (session.sessionLabels ?? []).map((l) => ({ type: l.type, quantity: l.quantity, semiPackaged: l.semiPackaged })),
      };
    });

    return NextResponse.json({
      batchNumber: batch.batchNumber,
      productName: batch.formulation.name,
      formulationId: batch.formulationId,
      producedQuantity: finalOutputKg,
      alreadyPackaged: totalPackagedWeight,
      totalLoss,
      remainingQuantity: Math.max(0, remainingQuantity),
      status,
      semiPackaged: batch.semiPackaged || 0,
      sessions,
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching packaging batch:", error);
    return NextResponse.json({ error: "Failed to fetch packaging batch" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ batchNumber: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized. Please log in to perform this action." }, { status: 401 });
    }
    const authenticatedUserId = (session.user as any).id as string;
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "User ID not found in session." }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
    if (!user) {
      return NextResponse.json({ error: "User not found in database." }, { status: 401 });
    }
    if (user.status !== "active") {
      return NextResponse.json({ error: "Your account is not active. Please contact an administrator." }, { status: 403 });
    }

    const { batchNumber } = await params as { batchNumber: string };
    const identifier = decodeURIComponent(batchNumber);
    const body = await request.json();
    const { items, remarks, labels, packagingLoss, courierBox } = body;

    let batch = await prisma.productionBatch.findUnique({
      where: { batchNumber: identifier },
      include: {
        formulation: true,
        packagingSessions: { include: { items: true } },
      },
    });

    if (!batch) {
      batch = await prisma.productionBatch.findUnique({
        where: { id: identifier },
        include: {
          formulation: true,
          packagingSessions: { include: { items: true } },
        },
      });
    }

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const totalPackagedWeight = batch.packagingSessions.reduce((sum, s) => {
      if (s.remarks && s.remarks.includes('Total:')) {
        const match = s.remarks.match(/Total:\s*([\d.]+)kg/);
        if (match) return sum + parseFloat(match[1]);
      }
      return sum;
    }, 0);

    const totalLoss = batch.packagingSessions.reduce((sum, s) => sum + s.packagingLoss, 0);

    const finalOutputKg =
      batch.unit === "kg"
        ? (batch.finalOutput ?? batch.plannedQuantity)
        : (batch.finalOutput ?? batch.plannedQuantity) / 1000;

    const remainingQuantity = finalOutputKg - totalPackagedWeight - totalLoss;

    if (remainingQuantity <= 0.01) {
      return NextResponse.json({ error: "Batch is already completed" }, { status: 400 });
    }

    const itemsArray = Array.isArray(items) ? items : [];
    let validatedProducts: any[] = [];

    if (itemsArray.length > 0) {
      const productIds = itemsArray.map((item: any) => item.containerId);
      const uniqueProductIds = [...new Set(productIds)]; // ← add this

      validatedProducts = await prisma.finishedProduct.findMany({
        where: { id: { in: uniqueProductIds } },
      });

      if (validatedProducts.length !== uniqueProductIds.length) { // ← use unique here
        return NextResponse.json({ error: "One or more products not found" }, { status: 404 });
      }
    }

    const labelEntries: Array<{ type: string; quantity: number }> =
      Array.isArray(labels) ? labels.filter((l: any) => l.type?.trim() && l.quantity > 0) : [];

    let labelRecordsForTx: Array<{ id: string; name: string }> = [];

    if (labelEntries.length > 0) {
      const labelNames = labelEntries.map((l) => l.type.toLowerCase().trim());
      const foundLabels = await prisma.label.findMany({
        where: { name: { in: labelNames } },
        include: { labelMovements: true },
      });

      for (const entry of labelEntries) {
        const labelRecord = foundLabels.find(
          (fl) => fl.name === entry.type.toLowerCase().trim()
        );
        if (!labelRecord) {
          return NextResponse.json(
            { error: `Label "${entry.type}" not found in inventory. Please add it first.` },
            { status: 404 }
          );
        }
        const currentStock = labelRecord.labelMovements.reduce(
          (total, m) => (m.action === "add" ? total + m.quantity : total - m.quantity),
          0
        );
        if (currentStock < entry.quantity) {
          return NextResponse.json(
            {
              error: `Insufficient stock for label "${entry.type}". Available: ${currentStock} pcs, Required: ${entry.quantity} pcs.`,
            },
            { status: 400 }
          );
        }
      }

      labelRecordsForTx = await prisma.label.findMany({
        where: { name: { in: labelNames } },
        select: { id: true, name: true },
      });
    }

    await prisma.$transaction(
      async (tx) => {
        const itemsWeight = itemsArray.reduce(
          (sum: number, item: any) => sum + parseFloat(item.totalWeight || 0),
          0
        );

        const lossFromBody = parseFloat(packagingLoss) || 0;
        const finalLoss = itemsArray.length > 0
          ? Math.max(0, remainingQuantity - itemsWeight - lossFromBody)
          : remainingQuantity - lossFromBody;

        const packagingDetails = itemsArray.map((item: any) => {
          const product = validatedProducts.find((p) => p.id === item.containerId);
          return `${product?.name ?? item.containerId}: ${item.numberOfPackets} packets (${item.totalWeight}kg)`;
        });

        const sessionRemarks = packagingDetails.length > 0
          ? `${remarks || ""} Packaged: ${packagingDetails.join(", ")}. Total: ${itemsWeight}kg`.trim()
          : remarks || "Batch marked as finished - remaining quantity counted as loss";

        const packagingSession = await tx.packagingSession.create({
          data: {
            batchId: batch!.id,
            date: new Date(),
            packagingLoss: Math.max(0, finalLoss),
            remarks: sessionRemarks,
            performedById: authenticatedUserId,
          },
        });

        for (const item of itemsArray) {
          const product = validatedProducts.find((p) => p.id === item.containerId);
          if (product) {
            await tx.finishedProduct.update({
              where: { id: product.id },
              data: {
                availableInventory:
                  (product.availableInventory || 0) + parseInt(item.numberOfPackets),
              },
            });
          }
        }

        if (labelEntries.length > 0) {
          await Promise.all(
            labelEntries.map((l) =>
              tx.sessionLabel.create({
                data: {
                  sessionId: packagingSession.id,
                  type: l.type.trim(),
                  quantity: l.quantity,
                },
              })
            )
          );
        }

        if (courierBox && courierBox.itemsPerBox > 0 && courierBox.boxesNeeded > 0) {
          const totalPackets = itemsArray.reduce(
            (sum: number, item: any) => sum + parseInt(item.numberOfPackets || 0),
            0
          );
          await tx.courierBox.create({
            data: {
              sessionId: packagingSession.id,
              label: courierBox.label || "Courier Box",
              itemsPerBox: courierBox.itemsPerBox,
              boxesNeeded: courierBox.boxesNeeded,
              totalPackets: courierBox.totalPackets ?? totalPackets,
            },
          });
        }

        for (const entry of labelEntries) {
          const labelRecord = labelRecordsForTx.find(
            (fl) => fl.name === entry.type.toLowerCase().trim()
          );
          if (!labelRecord) continue;

          await tx.labelMovement.create({
            data: {
              labelId: labelRecord.id,
              action: "reduce",
              quantity: entry.quantity,
              reason: "correction",
              remarks: `Used in packaging batch ${batch!.batchNumber}`,
              adjustmentDate: new Date(),
              performedById: authenticatedUserId,
            },
          });
        }
      },
      { timeout: 30000 }
    );

    return NextResponse.json(
      {
        message: "Batch marked as finished successfully",
        remainingQuantity,
        lossRecorded: remainingQuantity,
        labelsDeducted: labelEntries.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error finishing batch:", error);
    return NextResponse.json({ error: "Failed to finish batch" }, { status: 500 });
  }
}