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

    const { batchNumber } = (await params) as { batchNumber: string };
    const identifier = decodeURIComponent(batchNumber);

    const packagingSessionsInclude = {
      include: {
        items: { include: { container: true } },
        performedBy: { select: { fullName: true } },
        courierBoxes: true,
        // include boxType name so we can return it without extra queries
        sessionLabels: {
          include: {
            boxType: { select: { id: true, name: true } },
          },
        },
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

    const totalPackagedWeight = batch.packagingSessions.reduce((sum, s) => {
      if (s.remarks && s.remarks.includes("Total:")) {
        const match = s.remarks.match(/Total:\s*([\d.]+)kg/);
        if (match) return sum + parseFloat(match[1]);
      }
      return sum;
    }, 0);

    const totalLoss = batch.packagingSessions.reduce(
      (sum, s) => sum + s.packagingLoss,
      0
    );

    const finalOutputKg =
      batch.unit === "kg"
        ? (batch.finalOutput ?? batch.plannedQuantity)
        : (batch.finalOutput ?? batch.plannedQuantity) / 1000;

    const batchSemiPackagedKg = batch.semiPackaged || 0;
    const remainingQuantity =
      finalOutputKg - totalPackagedWeight - totalLoss - batchSemiPackagedKg;

    let status: "Not Started" | "Partial" | "Semi Packaged" | "Completed";
    if (remainingQuantity <= 0.01) {
      status = "Completed";
    } else if (totalPackagedWeight === 0 && batchSemiPackagedKg === 0) {
      status = "Not Started";
    } else if (batchSemiPackagedKg > 0) {
      status = "Semi Packaged";
    } else {
      status = "Partial";
    }

    // ── Build semiPackagedLabels map ────────────────────────────────────────
    const semiPackagedLabelMap: Record<string, number> = {};
    for (const s of batch.packagingSessions) {
      for (const sl of s.sessionLabels) {
        if (sl.semiPackaged) {
          semiPackagedLabelMap[sl.type] = (semiPackagedLabelMap[sl.type] || 0) + sl.quantity;
        }
      }
    }
    for (const s of batch.packagingSessions) {
      for (const sl of s.sessionLabels) {
        if (!sl.semiPackaged && semiPackagedLabelMap[sl.type] !== undefined) {
          if (s.remarks && s.remarks.includes("(conversion)")) {
            semiPackagedLabelMap[sl.type] = Math.max(
              0,
              (semiPackagedLabelMap[sl.type] || 0) - sl.quantity
            );
          }
        }
      }
    }

    const semiPackagedLabels = Object.entries(semiPackagedLabelMap)
      .filter(([, qty]) => qty > 0)
      .map(([type, quantity]) => ({ type, quantity }));

    // ── Build sessions response ─────────────────────────────────────────────
    const sessions = batch.packagingSessions.map((s) => {
      let sessionWeight = 0;
      if (s.remarks && s.remarks.includes("Total:")) {
        const match = s.remarks.match(/Total:\s*([\d.]+)kg/);
        if (match) sessionWeight = parseFloat(match[1]);
      }

      // Aggregate boxTypeDeductions from sessionLabels (uses the new columns)
      const boxTypeDeductionMap = new Map<
        string,
        { boxTypeName: string; boxesUsed: number }
      >();
      for (const sl of s.sessionLabels) {
        if (sl.semiPackaged) continue;
        const btId = (sl as any).boxTypeId as string | null;
        const btUsed = (sl as any).boxesUsed as number | null;
        if (!btId || !btUsed || btUsed <= 0) continue;
        const btName =
          (sl as any).boxType?.name ?? btId;
        const existing = boxTypeDeductionMap.get(btId);
        boxTypeDeductionMap.set(btId, {
          boxTypeName: btName,
          boxesUsed: (existing?.boxesUsed ?? 0) + btUsed,
        });
      }
      const boxTypeDeductions = Array.from(boxTypeDeductionMap.entries()).map(
        ([boxTypeId, val]) => ({
          boxTypeId,
          boxTypeName: val.boxTypeName,
          boxesUsed: val.boxesUsed,
        })
      );

      return {
        id: s.id,
        batchNumber: batch?.batchNumber,
        date: s.date.toISOString(),
        items: [],
        packagingLoss: s.packagingLoss,
        totalPackagedWeight: sessionWeight,
        semiPackaged: s.semiPackaged || 0,
        remarks: s.remarks,
        performedBy: s.performedBy?.fullName ?? null,
        courierBoxes: s.courierBoxes ?? [],
        labels: s.sessionLabels.map((l) => ({
          type: l.type,
          quantity: l.quantity,
          semiPackaged: l.semiPackaged,
          boxTypeId: (l as any).boxTypeId ?? null,
          boxesUsed: (l as any).boxesUsed ?? 0,
        })),
        boxTypeDeductions,
      };
    });

    return NextResponse.json(
      {
        batchNumber: batch.batchNumber,
        productName: batch.formulation.name,
        formulationId: batch.formulationId,
        producedQuantity: finalOutputKg,
        alreadyPackaged: totalPackagedWeight,
        totalLoss,
        remainingQuantity: Math.round(Math.max(0, remainingQuantity) * 100) / 100,
        status,
        semiPackaged: batchSemiPackagedKg,
        semiPackagedLabels,
        sessions,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching packaging batch:", error);
    return NextResponse.json(
      { error: "Failed to fetch packaging batch" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ batchNumber: string }> }
) {
  try {
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

    const { batchNumber } = (await params) as { batchNumber: string };
    const identifier = decodeURIComponent(batchNumber);
    const body = await request.json();
    const {
      items,
      remarks,
      labels,
      packagingLoss,
      date,
      courierBox,
      totalBoxes,
      boxTypeDeductions,
    } = body;

    let batch = await prisma.productionBatch.findUnique({
      where: { batchNumber: identifier },
      include: {
        formulation: true,
        packagingSessions: { include: { items: true, sessionLabels: true } },
      },
    });

    if (!batch) {
      batch = await prisma.productionBatch.findUnique({
        where: { id: identifier },
        include: {
          formulation: true,
          packagingSessions: { include: { items: true, sessionLabels: true } },
        },
      });
    }

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const totalPackagedWeight = batch.packagingSessions.reduce((sum, s) => {
      if (s.remarks && s.remarks.includes("Total:")) {
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
    const batchSemiPackagedKg = batch.semiPackaged || 0;
    const remainingQuantity =
      finalOutputKg - totalPackagedWeight - totalLoss - batchSemiPackagedKg;

    if (remainingQuantity <= 0.01 && batchSemiPackagedKg <= 0.01) {
      return NextResponse.json({ error: "Batch is already completed" }, { status: 400 });
    }

    const itemsArray = Array.isArray(items) ? items : [];
    let validatedProducts: any[] = [];

    if (itemsArray.length > 0) {
      const productIds = itemsArray.map((item: any) => item.containerId);
      const uniqueProductIds = [...new Set(productIds)];
      validatedProducts = await prisma.finishedProduct.findMany({
        where: { id: { in: uniqueProductIds } },
      });
      if (validatedProducts.length !== uniqueProductIds.length) {
        return NextResponse.json({ error: "One or more products not found" }, { status: 404 });
      }
    }

    const labelEntries: Array<{
      type: string;
      quantity: number;
      boxTypeId?: string | null;
      boxesUsed?: number;
      semiPackaged?: boolean;
      isConversion?: boolean;
    }> = Array.isArray(labels)
      ? labels.filter((l: any) => l.type?.trim() && l.quantity > 0)
      : [];

    // ── Pre-fetch and validate label stock ──────────────────────────────────
    let labelRecordsForTx: Array<{ id: string; name: string }> = [];

    if (labelEntries.length > 0) {
      const labelNames = labelEntries.map((l) => l.type.toLowerCase().trim());
      const foundLabels = await prisma.label.findMany({
        where: { name: { in: labelNames } },
        include: { labelMovements: true },
      });

      for (const entry of labelEntries) {
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

    // ── Build and validate box type deductions ──────────────────────────────
    const deductionsArray: Array<{ boxTypeId: string; boxesUsed: number }> =
      Array.isArray(boxTypeDeductions) && boxTypeDeductions.length > 0
        ? boxTypeDeductions.filter(
            (d: any) =>
              d.boxTypeId &&
              typeof d.boxesUsed === "number" &&
              d.boxesUsed > 0
          )
        : (() => {
            const totalBoxesNum = parseInt(totalBoxes) || 0;
            return totalBoxesNum > 0
              ? [{ boxTypeId: "fixed-boxes-item", boxesUsed: totalBoxesNum }]
              : [];
          })();

    for (const { boxTypeId, boxesUsed } of deductionsArray) {
      const boxType = await (prisma as any).boxType.findUnique({
        where: { id: boxTypeId },
      });
      if (!boxType) {
        if (boxTypeId !== "fixed-boxes-item") {
          return NextResponse.json(
            { error: `Box type not found for ID "${boxTypeId}".` },
            { status: 404 }
          );
        }
        continue;
      }
    }

    // ── Transaction ─────────────────────────────────────────────────────────
    await prisma.$transaction(
      async (tx) => {
        const itemsWeight = itemsArray.reduce(
          (sum: number, item: any) => sum + parseFloat(item.totalWeight || 0),
          0
        );
        const lossFromBody = parseFloat(packagingLoss) || 0;
        const hasConversions = labelEntries.some((l) => l.isConversion);
        const conversionNote = hasConversions ? ` (conversion)` : "";

        const finalLoss =
          itemsArray.length > 0
            ? Math.max(0, remainingQuantity - itemsWeight - lossFromBody)
            : remainingQuantity - lossFromBody;

        const packagingDetails = itemsArray.map((item: any) => {
          const product = validatedProducts.find((p) => p.id === item.containerId);
          return `${product?.name ?? item.containerId}: ${item.numberOfPackets} packets (${item.totalWeight}kg)`;
        });

        const isSemiPackagedSession =
          labelEntries.length > 0 && labelEntries.every((l) => l.semiPackaged === true);

        const sessionRemarks =
          packagingDetails.length > 0
            ? isSemiPackagedSession
              ? `${remarks || ""} Semi Packaging Session`.trim()
              : `${remarks || ""} Packaged: ${packagingDetails.join(", ")}. Total: ${itemsWeight}kg${conversionNote}`.trim()
            : remarks || "Batch marked as finished - remaining quantity counted as loss";

        const sessionDate = date ? new Date(date) : new Date();

        const packagingSession = await tx.packagingSession.create({
          data: {
            batchId: batch!.id,
            date: Number.isNaN(sessionDate.getTime()) ? new Date() : sessionDate,
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

        // Create session labels with boxTypeId and boxesUsed
        if (labelEntries.length > 0) {
          await Promise.all(
            labelEntries.map((l) =>
              tx.sessionLabel.create({
                data: {
                  sessionId: packagingSession.id,
                  type: l.type.trim(),
                  quantity: l.quantity,
                  semiPackaged: l.semiPackaged || false,
                  boxTypeId: l.semiPackaged ? null : (l.boxTypeId ?? null),
                  boxesUsed: l.semiPackaged ? 0 : (l.boxesUsed ?? 0),
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

        // Deduct label stock
        for (const entry of labelEntries) {
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
              remarks: `Used in packaging batch ${batch!.batchNumber}${entry.isConversion ? " (conversion)" : ""}`,
              adjustmentDate: new Date(),
              performedById: authenticatedUserId,
            },
          });

          if (entry.isConversion) {
            const conversionWeight = itemsArray.reduce((sum: number, item: any) => {
              const product = validatedProducts.find((p) => p.id === item.containerId);
              return product ? sum + parseFloat(item.totalWeight || 0) : sum;
            }, 0);
            await tx.productionBatch.update({
              where: { id: batch!.id },
              data: {
                semiPackaged: Math.max(
                  0,
                  (batch!.semiPackaged || 0) - conversionWeight
                ),
              },
            });
          }
        }
      },
      { timeout: 30000 }
    );

    // ── Per-box-type stock deduction (non-fatal, outside transaction) ────────
    for (const { boxTypeId, boxesUsed } of deductionsArray) {
      try {
        const boxType = await (prisma as any).boxType.findUnique({
          where: { id: boxTypeId },
        });
        if (!boxType) {
          console.warn(`Box type ${boxTypeId} not found — skipping deduction`);
          continue;
        }
        await Promise.all([
          (prisma as any).boxType.update({
            where: { id: boxTypeId },
            data: { availableStock: boxType.availableStock - boxesUsed },
          }),
          (prisma as any).boxMovement.create({
            data: {
              boxTypeId,
              action: "reduce",
              quantity: boxesUsed,
              reason: "packaging",
              reference: identifier,
              remarks: `Auto-deducted for batch ${identifier}`,
              performedById: authenticatedUserId,
            },
          }),
        ]);
      } catch (boxErr) {
        console.error(
          `Box deduction failed for boxTypeId ${boxTypeId} (non-fatal):`,
          boxErr
        );
      }
    }

    return NextResponse.json(
      {
        message: "Batch marked as finished successfully",
        remainingQuantity,
        lossRecorded: remainingQuantity,
        labelsDeducted: labelEntries.filter((l) => !l.semiPackaged).length,
        boxesDeducted: deductionsArray.reduce((sum, d) => sum + d.boxesUsed, 0),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error finishing batch:", error);
    return NextResponse.json(
      { error: "Failed to finish batch" },
      { status: 500 }
    );
  }
}
