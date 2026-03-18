export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

// ─── Shared auth helper ───────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: "Unauthorized. Please log in to perform this action.", status: 401 };
  }
  const authenticatedUserId = (session.user as any).id as string;
  if (!authenticatedUserId) {
    return { error: "User ID not found in session.", status: 401 };
  }
  const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
  if (!user) {
    return { error: "User not found in database.", status: 401 };
  }
  if (user.status !== "active") {
    return { error: "Your account is not active. Please contact an administrator.", status: 403 };
  }
  return { userId: authenticatedUserId };
}

// ─── Shared batch formatter ───────────────────────────────────────────────────

function formatBatch(batch: any) {
  const totalProductionCost = batch.materialUsages.reduce(
    (sum: number, usage: any) => sum + usage.cost, 0
  );
  const totalRawMaterialConsumed = batch.materialUsages.reduce(
    (sum: number, usage: any) => sum + usage.quantityUsed, 0
  );
  const finalOutputQuantity = batch.finalOutput ?? batch.plannedQuantity;
  const lossQuantity = batch.plannedQuantity - finalOutputQuantity;
  const expectedLossPercent =
    batch.plannedQuantity > 0 ? (lossQuantity / batch.plannedQuantity) * 100 : 0;
  const costPerKg = finalOutputQuantity > 0 ? totalProductionCost / finalOutputQuantity : 0;

  const materialRequirements = batch.materialUsages.map((usage: any) => ({
  rawMaterialId: usage.rawMaterialId,
  originalRawMaterialId: usage.rawMaterialId,        // ← add
  rawMaterialName: usage.rawMaterial.name,
  originalRawMaterialName: usage.rawMaterial.name,   // ← add
  requiredQuantity: usage.quantityUsed,
  actualQuantity: usage.quantityUsed,                // ← add
  unit: batch.unit.toLowerCase() as "kg" | "gm",
  availableStock: 0,
  stockStatus: "sufficient" as const,
  ratePerUnit: usage.ratePerUnit,
  originalRatePerUnit: usage.ratePerUnit,            // ← add
  cost: usage.cost,
  isChecked: true,                                   // already there
  status: "active" as const,                         // ← add
  originalStatus: "active" as const,                 // ← add
  originalAvailableStock: 0,                         // ← add
  alternativeRawMaterials: [],                       // ← add
}));

  let displayStatus: "draft" | "confirmed" = "draft";
  if (batch.status === "confirmed" || batch.status === "ready_for_packaging") {
    displayStatus = "confirmed";
  }

  return {
    id: batch.id,
    batchNumber: batch.batchNumber,
    formulationId: batch.formulationId,
    formulationName: batch.formulation.name,
    plannedQuantity: batch.plannedQuantity,
    unit: batch.unit.toLowerCase() as "kg" | "gm",
    expectedLossPercent,
    lossQuantity,
    finalOutputQuantity,
    totalRawMaterialConsumed,
    totalProductionCost,
    costPerKg,
    materialRequirements,
    productionDate: batch.productionDate.toISOString().split("T")[0],
    status: displayStatus,
    confirmedBy: batch.confirmedBy?.fullName,
    confirmedAt: batch.confirmedAt?.toISOString(),
    createdAt: batch.createdAt.toISOString(),
  };
}

const BATCH_INCLUDE = {
  formulation: true,
  materialUsages: { include: { rawMaterial: true } },
  confirmedBy: { select: { fullName: true } },
} as const;

// ─── GET /api/production/batches ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const batches = await prisma.productionBatch.findMany({
      include: BATCH_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(batches.map(formatBatch), { status: 200 });
  } catch (error) {
    console.error("Error fetching production batches:", error);
    return NextResponse.json({ error: "Failed to fetch production batches" }, { status: 500 });
  }
}

// ─── POST /api/production/batches ─────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { userId } = auth;

    const body = await request.json();
    const {
      formulationId,
      plannedQuantity,
      finalQuantity,
      unit,
      productionDate,
      materialRequirements,
      status: requestedStatus = "confirmed",
    } = body;

    if (
      !formulationId || !plannedQuantity || !finalQuantity ||
      !unit || !productionDate || !materialRequirements || !Array.isArray(materialRequirements)
    ) {
      return NextResponse.json(
        { error: "Missing required fields: formulationId, plannedQuantity, finalQuantity, unit, productionDate, and materialRequirements are required" },
        { status: 400 }
      );
    }

    if (!["kg", "gm"].includes(unit.toLowerCase())) {
      return NextResponse.json({ error: 'Invalid unit. Must be "kg" or "gm"' }, { status: 400 });
    }

    const isDraft = requestedStatus === "draft";

    const formulation = await prisma.formulation.findUnique({ where: { id: formulationId } });
    if (!formulation) {
      return NextResponse.json({ error: "Formulation not found" }, { status: 404 });
    }

    // Generate batch number
    const year = new Date().getFullYear();
    const existingBatches = await prisma.productionBatch.findMany({
      where: { batchNumber: { startsWith: `BATCH-${year}-` } },
      orderBy: { batchNumber: "desc" },
      take: 1,
    });
    let nextNumber = 1;
    if (existingBatches.length > 0) {
      const match = existingBatches[0].batchNumber.match(/BATCH-\d{4}-(\d{3})/);
      if (match) nextNumber = parseInt(match[1], 10) + 1;
    }
    const batchNumber = `BATCH-${year}-${String(nextNumber).padStart(3, "0")}`;
    const finalOutput = parseFloat(finalQuantity.toString());
    const dbStatus = isDraft ? "draft" : "ready_for_packaging";

    // ── Pre-fetch all raw materials OUTSIDE transaction ───────────────────────
    const checkedMaterials = materialRequirements.filter((req: any) => req.isChecked);
    const rawMaterialIds = checkedMaterials.map((req: any) => req.rawMaterialId);
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: { id: { in: rawMaterialIds } },
    });
    const rawMaterialMap = new Map(rawMaterials.map((m) => [m.id, m]));

    // Validate all materials exist before starting transaction
    for (const req of checkedMaterials) {
      if (!rawMaterialMap.has(req.rawMaterialId)) {
        return NextResponse.json(
          { error: `Raw material ${req.rawMaterialId} not found` },
          { status: 404 }
        );
      }
    }

    // ── Transaction with increased timeout ────────────────────────────────────
    const result = await prisma.$transaction(
      async (tx) => {
        const batch = await tx.productionBatch.create({
          data: {
            batchNumber,
            formulationId,
            plannedQuantity: parseFloat(plannedQuantity.toString()),
            unit: unit.toLowerCase() as "kg" | "gm",
            finalOutput,
            productionDate: new Date(productionDate),
            status: dbStatus,
            ...(isDraft ? {} : {
              confirmedById: userId,
              confirmedAt: new Date(),
            }),
          },
        });

        for (const req of checkedMaterials) {
          const rawMaterial = rawMaterialMap.get(req.rawMaterialId)!;

          let quantityUsed = req.actualQuantity || req.requiredQuantity;
          if (unit === "kg" && rawMaterial.unit === "gm") {
            quantityUsed = (req.actualQuantity || req.requiredQuantity) * 1000;
          } else if (unit === "gm" && rawMaterial.unit === "kg") {
            quantityUsed = (req.actualQuantity || req.requiredQuantity) / 1000;
          }

          await tx.materialUsage.create({
            data: {
              batchId: batch.id,
              rawMaterialId: req.rawMaterialId,
              quantityUsed,
              ratePerUnit: req.ratePerUnit,
              cost: req.cost,
            },
          });

          if (!isDraft) {
            await tx.stockMovement.create({
              data: {
                rawMaterialId: req.rawMaterialId,
                action: "reduce",
                quantity: quantityUsed,
                reason: "production",
                reference: batchNumber,
                performedById: userId,
              },
            });
          }
        }

        if (!isDraft) {
          await tx.packagingSession.create({
            data: {
              batchId: batch.id,
              date: new Date(productionDate),
              packagingLoss: 0,
              performedById: userId,
              remarks: null,
            },
          });
        }

        return batch;
      },
      { timeout: 30000 } // 30s timeout
    );

    const createdBatch = await prisma.productionBatch.findUnique({
      where: { id: result.id },
      include: BATCH_INCLUDE,
    });
    if (!createdBatch) throw new Error("Failed to fetch created batch");

    return NextResponse.json(formatBatch(createdBatch), { status: 201 });
  } catch (error) {
    console.error("Error creating production batch:", error);
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to create production batch" }, { status: 500 });
  }
}

// ─── PATCH /api/production/batches ────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { userId } = auth;

    const body = await request.json();
    const {
      batchId,
      materialRequirements,
      finalQuantity,
      status: requestedStatus = "confirmed",
    } = body;

    if (!batchId || !materialRequirements || !Array.isArray(materialRequirements)) {
      return NextResponse.json(
        { error: "Missing required fields: batchId and materialRequirements are required" },
        { status: 400 }
      );
    }

    const existingBatch = await prisma.productionBatch.findUnique({
      where: { id: batchId },
      include: { materialUsages: true },
    });
    if (!existingBatch) {
      return NextResponse.json({ error: "Production batch not found" }, { status: 404 });
    }
    if (existingBatch.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft batches can be updated via this endpoint" },
        { status: 400 }
      );
    }

    const isDraft = requestedStatus === "draft";
    const dbStatus = isDraft ? "draft" : "ready_for_packaging";
    const existingMaterialIds = new Set(existingBatch.materialUsages.map((u) => u.rawMaterialId));

    // ── Pre-fetch all raw materials OUTSIDE transaction ───────────────────────
    const allCheckedIds = materialRequirements
      .filter((req: any) => req.isChecked)
      .map((req: any) => req.rawMaterialId);

    const rawMaterials = await prisma.rawMaterial.findMany({
      where: { id: { in: allCheckedIds } },
    });
    const rawMaterialMap = new Map(rawMaterials.map((m) => [m.id, m]));

    const result = await prisma.$transaction(
      async (tx) => {
        const updateData: any = { status: dbStatus };
        if (finalQuantity != null) {
          updateData.finalOutput = parseFloat(finalQuantity.toString());
        }
        if (!isDraft) {
          updateData.confirmedById = userId;
          updateData.confirmedAt = new Date();
        }

        const updatedBatch = await tx.productionBatch.update({
          where: { id: batchId },
          data: updateData,
        });

        // Remove unchecked materials that were previously saved
        const uncheckedExistingIds = materialRequirements
          .filter((req: any) => !req.isChecked && existingMaterialIds.has(req.rawMaterialId))
          .map((req: any) => req.rawMaterialId);

        if (uncheckedExistingIds.length > 0) {
          await tx.materialUsage.deleteMany({
            where: { batchId, rawMaterialId: { in: uncheckedExistingIds } },
          });
        }

        // Add newly checked materials
        const newMaterials = materialRequirements.filter(
          (req: any) => req.isChecked && !existingMaterialIds.has(req.rawMaterialId)
        );

        for (const req of newMaterials) {
          const rawMaterial = rawMaterialMap.get(req.rawMaterialId);
          if (!rawMaterial) continue;

          let quantityUsed = req.actualQuantity || req.requiredQuantity;
          if (existingBatch.unit === "kg" && rawMaterial.unit === "gm") {
            quantityUsed = (req.actualQuantity || req.requiredQuantity) * 1000;
          } else if (existingBatch.unit === "gm" && rawMaterial.unit === "kg") {
            quantityUsed = (req.actualQuantity || req.requiredQuantity) / 1000;
          }

          await tx.materialUsage.create({
            data: {
              batchId,
              rawMaterialId: req.rawMaterialId,
              quantityUsed,
              ratePerUnit: req.ratePerUnit,
              cost: req.cost,
            },
          });

          if (!isDraft) {
            await tx.stockMovement.create({
              data: {
                rawMaterialId: req.rawMaterialId,
                action: "reduce",
                quantity: quantityUsed,
                reason: "production",
                reference: existingBatch.batchNumber,
                performedById: userId,
              },
            });
          }
        }

        // When finalising, deduct stock for materials already saved in the draft
        if (!isDraft) {
          const stillCheckedExisting = materialRequirements.filter(
            (req: any) => req.isChecked && existingMaterialIds.has(req.rawMaterialId)
          );

          for (const req of stillCheckedExisting) {
            const rawMaterial = rawMaterialMap.get(req.rawMaterialId);
            if (!rawMaterial) continue;

            let quantityUsed = req.actualQuantity || req.requiredQuantity;
            if (existingBatch.unit === "kg" && rawMaterial.unit === "gm") {
              quantityUsed = (req.actualQuantity || req.requiredQuantity) * 1000;
            } else if (existingBatch.unit === "gm" && rawMaterial.unit === "kg") {
              quantityUsed = (req.actualQuantity || req.requiredQuantity) / 1000;
            }

            await tx.stockMovement.create({
              data: {
                rawMaterialId: req.rawMaterialId,
                action: "reduce",
                quantity: quantityUsed,
                reason: "production",
                reference: existingBatch.batchNumber,
                performedById: userId,
              },
            });
          }

          await tx.packagingSession.create({
            data: {
              batchId,
              date: existingBatch.productionDate,
              packagingLoss: 0,
              performedById: userId,
              remarks: null,
            },
          });
        }

        return updatedBatch;
      },
      { timeout: 30000 } // 30s timeout
    );

    const updatedBatch = await prisma.productionBatch.findUnique({
      where: { id: result.id },
      include: BATCH_INCLUDE,
    });
    if (!updatedBatch) throw new Error("Failed to fetch updated batch");

    return NextResponse.json(formatBatch(updatedBatch), { status: 200 });
  } catch (error) {
    console.error("Error updating production batch:", error);
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update production batch" }, { status: 500 });
  }
}