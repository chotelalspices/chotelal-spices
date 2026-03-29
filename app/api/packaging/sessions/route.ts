export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(request: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to perform this action." },
        { status: 401 }
      );
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
      return NextResponse.json(
        { error: "Your account is not active. Please contact an administrator." },
        { status: 403 }
      );
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    const body = await request.json();
    const { batchNumber, date, items, packagingLoss, remarks, courierBox, labels, totalBoxes } = body;

    if (!batchNumber || !date) {
      return NextResponse.json(
        { error: "Missing required fields: batchNumber and date are required" },
        { status: 400 }
      );
    }

    const labelsArray: Array<{
      type: string;
      quantity: number;
      semiPackaged?: boolean;
      isConversion?: boolean;
    }> = Array.isArray(labels)
      ? labels.filter((l) => l.type?.trim() && l.quantity > 0)
      : [];

    const itemsArray = Array.isArray(items) ? items : [];

    if (itemsArray.length === 0 && labelsArray.length === 0) {
      return NextResponse.json(
        { error: "At least one packaged item or label entry is required" },
        { status: 400 }
      );
    }

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

    // ── Find batch ──────────────────────────────────────────────────────────
    let batch = await prisma.productionBatch.findUnique({ where: { batchNumber } });
    if (!batch) {
      batch = await prisma.productionBatch.findUnique({ where: { id: batchNumber } });
    }
    if (!batch) {
      return NextResponse.json({ error: "Production batch not found" }, { status: 404 });
    }

    // ── Validate products ───────────────────────────────────────────────────
    let products: any[] = [];
    if (itemsArray.length > 0) {
      const productIds = itemsArray.map((item: any) => item.containerId);
      const uniqueProductIds = [...new Set(productIds)];
      products = await prisma.finishedProduct.findMany({
        where: { id: { in: uniqueProductIds } },
      });
      if (products.length !== uniqueProductIds.length) {
        return NextResponse.json({ error: "One or more products not found" }, { status: 404 });
      }
    }

    // ── Pre-fetch label records OUTSIDE transaction ─────────────────────────
    let labelRecordsForTx: Array<{ id: string; name: string }> = [];

    if (labelsArray.length > 0) {
      const labelNames = labelsArray.map((l) => l.type.toLowerCase().trim());
      const foundLabels = await prisma.label.findMany({
        where: { name: { in: labelNames } },
        include: { labelMovements: true },
      });

      for (const entry of labelsArray) {
        if (entry.semiPackaged) continue;

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

    // ── Transaction ─────────────────────────────────────────────────────────
    const result = await prisma.$transaction(
      async (tx) => {
        const packagingSession = await tx.packagingSession.create({
          data: {
            batchId: batch?.id ?? "",
            date: new Date(date),
            packagingLoss: parseFloat(packagingLoss) || 0,
            remarks: remarks || null,
            performedById: authenticatedUserId,
          },
        });

        let totalPackagedWeight = 0;
        const packagingDetails: string[] = [];

        for (const item of itemsArray) {
          const product = products.find((p: any) => p.id === item.containerId);
          if (product) {
            await tx.finishedProduct.update({
              where: { id: product.id },
              data: {
                availableInventory:
                  (product.availableInventory || 0) + parseInt(item.numberOfPackets),
              },
            });
            totalPackagedWeight += parseFloat(item.totalWeight);
            packagingDetails.push(
              `${product.name}: ${item.numberOfPackets} packets (${item.totalWeight}kg)`
            );
          }
        }

        const isSemiPackagedSession =
          labelsArray.length > 0 && labelsArray.every((l) => l.semiPackaged === true);
        const hasConversions = labelsArray.some((l) => l.isConversion);
        const conversionNote = hasConversions ? " (conversion)" : "";

        if (packagingDetails.length > 0) {
          await tx.packagingSession.update({
            where: { id: packagingSession.id },
            data: {
              remarks: isSemiPackagedSession
                ? `${remarks || ""} Semi Packaging Session`.trim()
                : `${remarks || ""} Packaged: ${packagingDetails.join(", ")}. Total: ${totalPackagedWeight}kg${conversionNote}`.trim(),
            },
          });
        }

        let courierBoxRecord = null;
        if (courierBox) {
          const totalPackets = itemsArray.reduce(
            (sum: number, item: any) => sum + parseInt(item.numberOfPackets),
            0
          );
          courierBoxRecord = await tx.courierBox.create({
            data: {
              sessionId: packagingSession.id,
              label: courierBox.label || "Courier Box",
              itemsPerBox: courierBox.itemsPerBox,
              boxesNeeded: courierBox.boxesNeeded,
              totalPackets: courierBox.totalPackets ?? totalPackets,
            },
          });
        }

        let labelRecords: any[] = [];
        if (labelsArray.length > 0) {
          labelRecords = await Promise.all(
            labelsArray.map((l) =>
              tx.sessionLabel.create({
                data: {
                  sessionId: packagingSession.id,
                  type: l.type.trim(),
                  quantity: l.quantity,
                  semiPackaged: l.semiPackaged || false,
                },
              })
            )
          );
        }

        if (isSemiPackagedSession && totalPackagedWeight > 0) {
          await tx.packagingSession.update({
            where: { id: packagingSession.id },
            data: { semiPackaged: totalPackagedWeight },
          });
          await tx.productionBatch.update({
            where: { id: batch!.id },
            data: { semiPackaged: (batch!.semiPackaged || 0) + totalPackagedWeight },
          });
        }

        if (labelsArray.length > 0 && labelRecordsForTx.length > 0) {
          for (const entry of labelsArray) {
            if (entry.semiPackaged) continue;

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
                remarks: `Used in packaging — batch ${batch!.batchNumber}${entry.isConversion ? " (conversion)" : ""}`,
                adjustmentDate: new Date(),
                performedById: authenticatedUserId,
              },
            });

            if (entry.isConversion) {
              await tx.productionBatch.update({
                where: { id: batch!.id },
                data: {
                  semiPackaged: Math.max(0, (batch!.semiPackaged || 0) - totalPackagedWeight),
                },
              });
            }
          }
        }

        return { packagingSession, courierBoxRecord, labelRecords };
      },
      { timeout: 30000 }
    );

    // ── Box inventory deduction (non-fatal, outside transaction) ─────────────
    const totalBoxesNum = parseInt(totalBoxes) || 0;
    if (totalBoxesNum > 0) {
      try {
        const boxItem = await (prisma as any).boxInventory.findUnique({
          where: { id: "fixed-boxes-item" },
        });
        if (boxItem) {
          await Promise.all([
            (prisma as any).boxInventory.update({
              where: { id: "fixed-boxes-item" },
              data: { availableStock: boxItem.availableStock - totalBoxesNum },
            }),
            (prisma as any).boxMovement.create({
              data: {
                action: "reduce",
                quantity: totalBoxesNum,
                reason: "packaging",
                reference: batchNumber,
                remarks: `Auto-deducted for batch ${batchNumber}`,
                performedById: authenticatedUserId,
              },
            }),
          ]);
        }
      } catch (boxErr) {
        console.error("Box deduction failed (non-fatal):", boxErr);
      }
    }

    // ── Fetch created session for response ──────────────────────────────────
    const createdSession = await prisma.packagingSession.findUnique({
      where: { id: result.packagingSession.id },
      include: {
        performedBy: { select: { fullName: true } },
        batch: { include: { formulation: true } },
        courierBoxes: true,
        sessionLabels: true,
      },
    });

    if (!createdSession) throw new Error("Failed to fetch created session");

    let totalPackagedWeight = 0;
    if (createdSession.remarks?.includes("Total:")) {
      const match = createdSession.remarks.match(/Total:\s*([\d.]+)kg/);
      if (match) totalPackagedWeight = parseFloat(match[1]);
    }

    return NextResponse.json(
      {
        id: createdSession.id,
        batchNumber: createdSession.batch?.batchNumber || "",
        date: createdSession.date.toISOString(),
        items: [],
        packagingLoss: createdSession.packagingLoss,
        totalPackagedWeight,
        semiPackaged: createdSession.semiPackaged,
        remarks: createdSession.remarks,
        performedBy: createdSession.performedBy?.fullName ?? null,
        courierBox: createdSession.courierBoxes[0] ?? null,
        labels: createdSession.sessionLabels.map((l) => ({
          type: l.type,
          quantity: l.quantity,
          semiPackaged: l.semiPackaged,
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating packaging session:", error);
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to create packaging session" },
      { status: 500 }
    );
  }
}