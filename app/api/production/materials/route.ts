export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const formulationId = searchParams.get("formulationId");
    const plannedQuantity = searchParams.get("plannedQuantity");

    if (!formulationId || !plannedQuantity) {
      return NextResponse.json(
        { error: "formulationId and plannedQuantity are required" },
        { status: 400 }
      );
    }

    const plannedQty = parseFloat(plannedQuantity);
    if (isNaN(plannedQty) || plannedQty <= 0) {
      return NextResponse.json(
        { error: "plannedQuantity must be a positive number" },
        { status: 400 }
      );
    }

    // Fetch formulation with ingredients
    const formulation = await prisma.formulation.findUnique({
      where: { id: formulationId },
      include: {
        ingredients: {
          include: {
            rawMaterial: {
              include: {
                stockMovements: true,
              },
            },
          },
        },
      },
    });

    if (!formulation) {
      return NextResponse.json(
        { error: "Formulation not found" },
        { status: 404 }
      );
    }

    // Fetch all active raw materials for alternatives
    const allRawMaterials = await prisma.rawMaterial.findMany({
      where: { status: 'active' },
      include: {
        stockMovements: true,
      },
    });

    // Calculate material requirements
    const scaleFactor = plannedQty / formulation.baseQuantity;
    const requirements = [];

    for (const ingredient of formulation.ingredients) {
      const rawMaterial = ingredient.rawMaterial;

      // Calculate available stock
      const availableStock = rawMaterial.stockMovements.reduce(
        (total, movement) => {
          if (movement.action === "add") {
            return total + movement.quantity;
          } else {
            return total - movement.quantity;
          }
        },
        0
      );

      // Calculate required quantity based on percentage
      const baseRequiredQty =
        (ingredient.percentage / 100) * formulation.baseQuantity;
      const requiredQuantity = baseRequiredQty * scaleFactor;

      // Convert units if necessary for stock comparison
      let availableInSameUnit = availableStock;
      if (formulation.baseUnit !== rawMaterial.unit) {
        if (formulation.baseUnit === "kg" && rawMaterial.unit === "gm") {
          // Required is in kg, stock is in gm - convert stock to kg
          availableInSameUnit = availableStock / 1000;
        } else {
          // Required is in gm, stock is in kg - convert stock to gm
          availableInSameUnit = availableStock * 1000;
        }
      }

      const stockStatus: "sufficient" | "insufficient" =
        availableInSameUnit >= requiredQuantity ? "sufficient" : "insufficient";

      // Calculate cost
      let cost: number;
      if (formulation.baseUnit === rawMaterial.unit) {
        cost = requiredQuantity * rawMaterial.costPerUnit;
      } else if (formulation.baseUnit === "kg" && rawMaterial.unit === "gm") {
        cost = requiredQuantity * 1000 * rawMaterial.costPerUnit;
      } else {
        cost = (requiredQuantity / 1000) * rawMaterial.costPerUnit;
      }

      // Prepare alternative raw materials (excluding current one)
      const alternativeRawMaterials = allRawMaterials
        .filter(rm => rm.id !== rawMaterial.id && rm.status === 'active')
        .map(rm => {
          const altAvailableStock = rm.stockMovements.reduce(
            (total, movement) => {
              if (movement.action === "add") {
                return total + movement.quantity;
              } else {
                return total - movement.quantity;
              }
            },
            0
          );

          return {
            id: rm.id,
            name: rm.name,
            unit: rm.unit.toLowerCase() as "kg" | "gm",
            costPerUnit: rm.costPerUnit,
            availableStock: altAvailableStock,
            status: rm.status,
          };
        });

      requirements.push({
        rawMaterialId: rawMaterial.id,
        rawMaterialName: rawMaterial.name,
        requiredQuantity,
        actualQuantity: requiredQuantity, // Default to required quantity
        unit: formulation.baseUnit.toLowerCase() as "kg" | "gm",
        availableStock,
        stockStatus,
        ratePerUnit: rawMaterial.costPerUnit,
        cost,
        isChecked: false,
        status: rawMaterial.status,
        originalRawMaterialId: rawMaterial.id, // Track original material
        originalRawMaterialName: rawMaterial.name, // Store original material name
        originalRatePerUnit: rawMaterial.costPerUnit, // Store original rate
        originalAvailableStock: availableStock, // Store original stock
        originalStatus: rawMaterial.status, // Store original status
        alternativeRawMaterials,
      });
    }

    return NextResponse.json(requirements, { status: 200 });
  } catch (error) {
    console.error("Error calculating material requirements:", error);
    return NextResponse.json(
      { error: "Failed to calculate material requirements" },
      { status: 500 }
    );
  }
}
