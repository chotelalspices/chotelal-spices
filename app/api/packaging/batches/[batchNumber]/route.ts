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
        remarks: session.remarks,
        performedBy: session.performedBy ? session.performedBy.fullName : null,
        courierBoxes: session.courierBoxes ?? [],
        labels: (session.sessionLabels ?? []).map((l) => ({ type: l.type, quantity: l.quantity })),
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

    // labels: Array<{ type: string; quantity: number }> — passed from frontend
    const { items, remarks, labels } = body;

    // ── Find batch ────────────────────────────────────────────────────────────
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

    // ── Calculate remaining ───────────────────────────────────────────────────
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

    // ── Validate containers ───────────────────────────────────────────────────
    let validatedContainers: any[] = [];
    if (items && Array.isArray(items) && items.length > 0) {
      const containerIds = items.map((item: any) => item.containerId);
      validatedContainers = await prisma.containerSize.findMany({
        where: { id: { in: containerIds } },
      });
      if (validatedContainers.length !== containerIds.length) {
        return NextResponse.json({ error: "One or more container sizes not found" }, { status: 404 });
      }
    }

    // ── Validate labels exist in Label inventory ──────────────────────────────
    const labelEntries: Array<{ type: string; quantity: number }> =
      Array.isArray(labels) ? labels.filter((l: any) => l.type?.trim() && l.quantity > 0) : [];

    if (labelEntries.length > 0) {
      const labelNames = labelEntries.map((l) => l.type.toLowerCase().trim());
      const foundLabels = await prisma.label.findMany({
        where: { name: { in: labelNames } },
        include: { labelMovements: true },
      });

      // Check each label exists and has sufficient stock
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

        const currentStock = labelRecord.labelMovements.reduce((total, m) =>
          m.action === "add" ? total + m.quantity : total - m.quantity, 0
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

      // Re-fetch for use inside transaction
      var labelRecordsForTx = await prisma.label.findMany({
        where: { name: { in: labelNames } },
      });
    }

    // ── Transaction: create session + packaged items + label movements ────────
    await prisma.$transaction(async (tx) => {
      const itemsWeight =
        items && Array.isArray(items) && items.length > 0
          ? items.reduce((sum: number, item: any) => sum + parseFloat(item.totalWeight || 0), 0)
          : 0;

      const finalLoss = Math.max(0, remainingQuantity - itemsWeight);

      // 1. Create packaging session
      const packagingSession = await tx.packagingSession.create({
        data: {
          batchId: batch!.id,
          date: new Date(),
          packagingLoss: finalLoss,
          remarks:
            remarks ||
            "Batch marked as finished - remaining quantity counted as loss",
          performedById: authenticatedUserId,
        },
      });

      // 2. Create packaged items if any
      if (items && Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          await tx.packagedItem.create({
            data: {
              sessionId: packagingSession.id,
              containerId: item.containerId,
              numberOfPackets: parseInt(item.numberOfPackets),
              totalWeight: parseFloat(item.totalWeight),
            },
          });
        }
      }

      // 3. Deduct label stock — create LabelMovement for each label
      if (labelEntries.length > 0 && labelRecordsForTx) {
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
              reason: "correction", // closest reason for packaging usage
              remarks: `Used in packaging batch ${batch!.batchNumber}`,
              adjustmentDate: new Date(),
              performedById: authenticatedUserId,
            },
          });
        }
      }
    });

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