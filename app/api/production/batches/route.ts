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

    // Fetch all production batches with relations
    const batches = await prisma.productionBatch.findMany({
      include: {
        formulation: true,
        materialUsages: {
          include: {
            rawMaterial: true,
          },
        },
        confirmedBy: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Format batches to match component expectations
    const formattedBatches = batches.map((batch) => {
      // Calculate total production cost from material usages
      const totalProductionCost = batch.materialUsages.reduce(
        (sum, usage) => sum + usage.cost,
        0
      );

      // Calculate total raw material consumed
      const totalRawMaterialConsumed = batch.materialUsages.reduce(
        (sum, usage) => sum + usage.quantityUsed,
        0
      );

      // Calculate final output quantity (use finalOutput if available, otherwise use plannedQuantity)
      const finalOutputQuantity = batch.finalOutput ?? batch.plannedQuantity;

      // Calculate loss (difference between planned and final output)
      const lossQuantity = batch.plannedQuantity - finalOutputQuantity;
      const expectedLossPercent =
        batch.plannedQuantity > 0
          ? (lossQuantity / batch.plannedQuantity) * 100
          : 0;

      // Calculate cost per kg
      const costPerKg =
        finalOutputQuantity > 0
          ? totalProductionCost / finalOutputQuantity
          : 0;

      // Map material usages to material requirements format
      const materialRequirements = batch.materialUsages.map((usage) => ({
        rawMaterialId: usage.rawMaterialId,
        rawMaterialName: usage.rawMaterial.name,
        requiredQuantity: usage.quantityUsed,
        unit: batch.unit.toLowerCase() as "kg" | "gm",
        availableStock: 0, // Not needed for display
        stockStatus: "sufficient" as const,
        ratePerUnit: usage.ratePerUnit,
        cost: usage.cost,
        isChecked: true,
      }));

      // Map status: ready_for_packaging -> confirmed for display purposes
      let displayStatus: "draft" | "confirmed" = "draft";
      if (
        batch.status === "confirmed" ||
        batch.status === "ready_for_packaging"
      ) {
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
    });

    return NextResponse.json(formattedBatches, { status: 200 });
  } catch (error) {
    console.error("Error fetching production batches:", error);
    return NextResponse.json(
      { error: "Failed to fetch production batches" },
      { status: 500 }
    );
  }
}

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
    const {
      formulationId,
      plannedQuantity,
      numberOfLots,
      finalQuantity,
      unit,
      productionDate,
      materialRequirements,
    } = body;

    // Validate required fields
    if (
      !formulationId ||
      !plannedQuantity ||
      !finalQuantity ||
      !unit ||
      !productionDate ||
      !materialRequirements ||
      !Array.isArray(materialRequirements)
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: formulationId, plannedQuantity, finalQuantity, unit, productionDate, and materialRequirements are required",
        },
        { status: 400 }
      );
    }

    // Validate unit enum
    if (!["kg", "gm"].includes(unit.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid unit. Must be "kg" or "gm"' },
        { status: 400 }
      );
    }

    // Verify formulation exists
    const formulation = await prisma.formulation.findUnique({
      where: { id: formulationId },
    });

    if (!formulation) {
      return NextResponse.json(
        { error: "Formulation not found" },
        { status: 404 }
      );
    }

    // Generate batch number
    const year = new Date().getFullYear();
    const existingBatches = await prisma.productionBatch.findMany({
      where: {
        batchNumber: {
          startsWith: `BATCH-${year}-`,
        },
      },
      orderBy: {
        batchNumber: "desc",
      },
      take: 1,
    });

    let nextNumber = 1;
    if (existingBatches.length > 0) {
      const match = existingBatches[0].batchNumber.match(
        /BATCH-\d{4}-(\d{3})/
      );
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    const batchNumber = `BATCH-${year}-${String(nextNumber).padStart(3, "0")}`;

    // Calculate final output (use finalQuantity from frontend, fallback to plannedQuantity for backward compatibility)
    const finalOutput = parseFloat(finalQuantity.toString());

    // Create production batch and material usages in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the production batch
      const batch = await tx.productionBatch.create({
        data: {
          batchNumber,
          formulationId,
          plannedQuantity: parseFloat(plannedQuantity.toString()),
          unit: unit.toLowerCase() as "kg" | "gm",
          finalOutput,
          productionDate: new Date(productionDate),
          status: "ready_for_packaging",
          confirmedById: authenticatedUserId,
          confirmedAt: new Date(),
        },
      });

      // Create material usages and stock movements
      for (const req of materialRequirements) {
        if (!req.isChecked) {
          continue; // Skip unchecked materials only
        }

        const rawMaterial = await tx.rawMaterial.findUnique({
          where: { id: req.rawMaterialId },
        });

        if (!rawMaterial) {
          throw new Error(`Raw material ${req.rawMaterialId} not found`);
        }

        // Calculate quantity used (convert units if necessary)
        let quantityUsed = req.actualQuantity || req.requiredQuantity;
        if (unit === "kg" && rawMaterial.unit === "gm") {
          quantityUsed = (req.actualQuantity || req.requiredQuantity) * 1000;
        } else if (unit === "gm" && rawMaterial.unit === "kg") {
          quantityUsed = (req.actualQuantity || req.requiredQuantity) / 1000;
        }

        // Create material usage
        await tx.materialUsage.create({
          data: {
            batchId: batch.id,
            rawMaterialId: req.rawMaterialId,
            quantityUsed,
            ratePerUnit: req.ratePerUnit,
            cost: req.cost,
          },
        });

        // Create stock movement to reduce inventory
        await tx.stockMovement.create({
          data: {
            rawMaterialId: req.rawMaterialId,
            action: "reduce",
            quantity: quantityUsed,
            reason: "production",
            reference: batchNumber,
            performedById: authenticatedUserId,
          },
        });
      }

      // Create initial packaging session for the batch
      await tx.packagingSession.create({
        data: {
          batchId: batch.id,
          date: new Date(productionDate),
          packagingLoss: 0,
          performedById: authenticatedUserId,
          remarks: null,
        },
      });

      return batch;
    });

    // Fetch the created batch with relations
    const createdBatch = await prisma.productionBatch.findUnique({
      where: { id: result.id },
      include: {
        formulation: true,
        materialUsages: {
          include: {
            rawMaterial: true,
          },
        },
        confirmedBy: {
          select: {
            fullName: true,
          },
        },
      },
    });

    if (!createdBatch) {
      throw new Error("Failed to fetch created batch");
    }

    // Calculate summary
    const totalProductionCost = createdBatch.materialUsages.reduce(
      (sum, usage) => sum + usage.cost,
      0
    );
    const costPerKg =
      createdBatch.finalOutput && createdBatch.finalOutput > 0
        ? totalProductionCost / createdBatch.finalOutput
        : 0;

    return NextResponse.json(
      {
        id: createdBatch.id,
        batchNumber: createdBatch.batchNumber,
        formulationId: createdBatch.formulationId,
        formulationName: createdBatch.formulation.name,
        plannedQuantity: createdBatch.plannedQuantity,
        unit: createdBatch.unit.toLowerCase() as "kg" | "gm",
        finalOutput: createdBatch.finalOutput,
        productionDate: createdBatch.productionDate.toISOString(),
        status: createdBatch.status.toLowerCase() as
          | "draft"
          | "confirmed"
          | "ready_for_packaging",
        confirmedBy: createdBatch.confirmedBy?.fullName,
        confirmedAt: createdBatch.confirmedAt?.toISOString(),
        createdAt: createdBatch.createdAt.toISOString(),
        totalProductionCost,
        costPerKg,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating production batch:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to create production batch" },
      { status: 500 }
    );
  }
}
