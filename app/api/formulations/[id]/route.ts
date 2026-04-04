export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const includeAudit = request.nextUrl.searchParams.get("audit") === "true";

    const formulation = await prisma.formulation.findUnique({
      where: { id },
      include: {
        ingredients: { include: { rawMaterial: true } },
        ...(includeAudit && {
          auditLogs: {
            orderBy: { changedAt: "desc" },
            include: { changedBy: { select: { fullName: true } } },
          },
        }),
      },
    });

    const previousProductions = await prisma.productionBatch.findMany({
      where: {
        formulationId: id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!formulation) {
      return NextResponse.json({ error: "Formulation not found" }, { status: 404 });
    }

    return NextResponse.json({
  id: formulation.id,
  name: formulation.name,
  baseQuantity: formulation.baseQuantity,
  baseUnit: formulation.baseUnit.toLowerCase() as "kg" | "gm",
  defaultQuantity: formulation.defaultQuantity,
  status: formulation.status.toLowerCase() as "active" | "inactive",

  ingredients: formulation.ingredients.map((ing) => ({
    rawMaterialId: ing.rawMaterialId,
    rawMaterialName: ing.rawMaterial.name,
    rawMaterialUnit: ing.rawMaterial.unit.toLowerCase() as "kg" | "gm",
    rawMaterialCostPerUnit: ing.rawMaterial.costPerUnit,
    percentage: ing.percentage,
  })),

  previousProductions: previousProductions.map((batch) => ({
  id: batch.id,
  batchNumber: batch.batchNumber,
  plannedQuantity: batch.plannedQuantity,
  availableQuantity: batch.availableQuantity,
  status: batch.status,
  unit: batch.unit?.toLowerCase?.() ?? null,
  createdAt: batch.createdAt.toISOString(),
  semiPackaged: batch.semiPackaged,
})),

  createdAt: formulation.createdAt.toISOString(),
  updatedAt: formulation.updatedAt.toISOString(),

  ...(includeAudit && {
    auditLogs: (formulation as any).auditLogs?.map((log: any) => ({
      id: log.id,
      changedAt: log.changedAt.toISOString(),
      changedBy: log.changedBy ?? null,
      changes: log.changes,
    })),
  }),
}, { status: 200 });
  } catch (error) {
    console.error("Error fetching formulation:", error);
    return NextResponse.json({ error: "Failed to fetch formulation" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const authenticatedUserId = (session.user as any).id as string;
    const { id } = await params;
    const body = await request.json();
    const { name, baseQuantity, baseUnit, defaultQuantity, status, ingredients } = body;

    if (!name || baseQuantity === undefined || !baseUnit || defaultQuantity === undefined || !status || !ingredients || !Array.isArray(ingredients)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!["kg", "gm"].includes(baseUnit.toLowerCase())) {
      return NextResponse.json({ error: 'Invalid unit. Must be "kg" or "gm"' }, { status: 400 });
    }
    if (!["active", "inactive"].includes(status.toLowerCase())) {
      return NextResponse.json({ error: 'Invalid status. Must be "active" or "inactive"' }, { status: 400 });
    }
    if (ingredients.length === 0) {
      return NextResponse.json({ error: "At least one ingredient is required" }, { status: 400 });
    }

    const totalPercentage = ingredients.reduce((sum: number, ing: any) => sum + (parseFloat(ing.percentage) || 0), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return NextResponse.json({ error: "Total percentage must be exactly 100%" }, { status: 400 });
    }

    for (const ingredient of ingredients) {
      if (!ingredient.rawMaterialId || ingredient.percentage === undefined) {
        return NextResponse.json({ error: "Each ingredient must have rawMaterialId and percentage" }, { status: 400 });
      }
      const rawMaterial = await prisma.rawMaterial.findUnique({ where: { id: ingredient.rawMaterialId } });
      if (!rawMaterial) {
        return NextResponse.json({ error: `Raw material with id ${ingredient.rawMaterialId} not found` }, { status: 400 });
      }
    }

    // Snapshot before update for audit log
    const currentFormulation = await prisma.formulation.findUnique({
      where: { id },
      include: { ingredients: { include: { rawMaterial: true } } },
    });

    if (!currentFormulation) {
      return NextResponse.json({ error: "Formulation not found" }, { status: 404 });
    }

    const snapshot = {
      name: currentFormulation.name,
      baseQuantity: currentFormulation.baseQuantity,
      baseUnit: currentFormulation.baseUnit.toLowerCase(),
      status: currentFormulation.status.toLowerCase(),
      ingredients: currentFormulation.ingredients.map((ing) => ({
        rawMaterialId: ing.rawMaterialId,
        rawMaterialName: ing.rawMaterial.name,
        rawMaterialUnit: ing.rawMaterial.unit.toLowerCase(),
        rawMaterialCostPerUnit: ing.rawMaterial.costPerUnit,
        percentage: ing.percentage,
      })),
    };

    await prisma.$transaction(async (tx) => {
      await tx.formulation.update({
        where: { id },
        data: {
          name: name.trim(),
          baseQuantity: parseFloat(baseQuantity),
          baseUnit: baseUnit.toLowerCase() as "kg" | "gm",
          defaultQuantity: parseFloat(defaultQuantity),
          status: status.toLowerCase() as "active" | "inactive",
        },
      });
      await tx.formulationIngredient.deleteMany({ where: { formulationId: id } });
      await tx.formulationIngredient.createMany({
        data: ingredients.map((ing: any) => ({
          formulationId: id,
          rawMaterialId: ing.rawMaterialId,
          percentage: parseFloat(ing.percentage),
        })),
      });
      await tx.formulationAudit.create({
        data: { formulationId: id, changedById: authenticatedUserId, changes: snapshot },
      });
    });

    const updatedFormulation = await prisma.formulation.findUnique({
      where: { id },
      include: { ingredients: { include: { rawMaterial: true } } },
    });

    if (!updatedFormulation) throw new Error("Failed to fetch updated formulation");

    return NextResponse.json({
      id: updatedFormulation.id,
      name: updatedFormulation.name,
      baseQuantity: updatedFormulation.baseQuantity,
      baseUnit: updatedFormulation.baseUnit.toLowerCase() as "kg" | "gm",
      defaultQuantity: updatedFormulation.defaultQuantity,
      status: updatedFormulation.status.toLowerCase() as "active" | "inactive",
      ingredients: updatedFormulation.ingredients.map((ing) => ({
        rawMaterialId: ing.rawMaterialId,
        percentage: ing.percentage,
      })),
      createdAt: updatedFormulation.createdAt.toISOString(),
      updatedAt: updatedFormulation.updatedAt.toISOString(),
    }, { status: 200 });
  } catch (error) {
    console.error("Error updating formulation:", error);
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A formulation with this name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update formulation" }, { status: 500 });
  }
}