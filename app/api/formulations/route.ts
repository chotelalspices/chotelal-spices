export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    const formulations = await prisma.formulation.findMany({
      include: {
        ingredients: {
          include: {
            rawMaterial: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedFormulations = formulations.map((formulation) => ({
      id: formulation.id,
      name: formulation.name,
      baseQuantity: formulation.baseQuantity,
      baseUnit: formulation.baseUnit.toLowerCase() as 'kg' | 'gm',
      defaultQuantity: formulation.defaultQuantity,
      status: formulation.status.toLowerCase() as 'active' | 'inactive',
      ingredients: formulation.ingredients.map((ing) => ({
        rawMaterialId: ing.rawMaterialId,
        percentage: ing.percentage,
      })),
      createdAt: formulation.createdAt.toISOString(),
      updatedAt: formulation.updatedAt.toISOString(),
    }));

    return NextResponse.json(formattedFormulations, { status: 200 });
  } catch (error) {
    console.error('Error fetching formulations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch formulations' },
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
        { error: 'Unauthorized. Please log in to perform this action.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      baseQuantity,
      baseUnit,
      defaultQuantity,
      status,
      ingredients,
    } = body;

    // Validate required fields
    if (!name || baseQuantity === undefined || !baseUnit || defaultQuantity === undefined || !status || !ingredients || !Array.isArray(ingredients)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, baseQuantity, baseUnit, defaultQuantity, status, and ingredients are required' },
        { status: 400 }
      );
    }

    // Validate unit enum
    if (!['kg', 'gm'].includes(baseUnit.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid unit. Must be "kg" or "gm"' },
        { status: 400 }
      );
    }

    // Validate status enum
    if (!['active', 'inactive'].includes(status.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "active" or "inactive"' },
        { status: 400 }
      );
    }

    // Validate ingredients
    if (ingredients.length === 0) {
      return NextResponse.json(
        { error: 'At least one ingredient is required' },
        { status: 400 }
      );
    }

    // Validate percentage totals
    const totalPercentage = ingredients.reduce((sum: number, ing: any) => {
      return sum + (parseFloat(ing.percentage) || 0);
    }, 0);

    if (Math.abs(totalPercentage - 100) > 0.01) {
      return NextResponse.json(
        { error: 'Total percentage must be exactly 100%' },
        { status: 400 }
      );
    }

    // Validate each ingredient
    for (const ingredient of ingredients) {
      if (!ingredient.rawMaterialId || ingredient.percentage === undefined) {
        return NextResponse.json(
          { error: 'Each ingredient must have rawMaterialId and percentage' },
          { status: 400 }
        );
      }

      // Verify raw material exists
      const rawMaterial = await prisma.rawMaterial.findUnique({
        where: { id: ingredient.rawMaterialId },
      });

      if (!rawMaterial) {
        return NextResponse.json(
          { error: `Raw material with id ${ingredient.rawMaterialId} not found` },
          { status: 400 }
        );
      }
    }

    // Create formulation with ingredients in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the formulation
      const formulation = await tx.formulation.create({
        data: {
          name: name.trim(),
          baseQuantity: parseFloat(baseQuantity),
          baseUnit: baseUnit.toLowerCase() as 'kg' | 'gm',
          defaultQuantity: parseFloat(defaultQuantity),
          status: status.toLowerCase() as 'active' | 'inactive',
        },
      });

      // Create ingredients
      await tx.formulationIngredient.createMany({
        data: ingredients.map((ing: any) => ({
          formulationId: formulation.id,
          rawMaterialId: ing.rawMaterialId,
          percentage: parseFloat(ing.percentage),
        })),
      });

      return formulation;
    });

    // Fetch the created formulation with ingredients
    const createdFormulation = await prisma.formulation.findUnique({
      where: { id: result.id },
      include: {
        ingredients: {
          include: {
            rawMaterial: true,
          },
        },
      },
    });

    if (!createdFormulation) {
      throw new Error('Failed to fetch created formulation');
    }

    return NextResponse.json(
      {
        id: createdFormulation.id,
        name: createdFormulation.name,
        baseQuantity: createdFormulation.baseQuantity,
        baseUnit: createdFormulation.baseUnit.toLowerCase() as 'kg' | 'gm',
        defaultQuantity: createdFormulation.defaultQuantity,
        status: createdFormulation.status.toLowerCase() as 'active' | 'inactive',
        ingredients: createdFormulation.ingredients.map((ing) => ({
          rawMaterialId: ing.rawMaterialId,
          percentage: ing.percentage,
        })),
        createdAt: createdFormulation.createdAt.toISOString(),
        updatedAt: createdFormulation.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating formulation:', error);
    
    // Handle Prisma validation errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'A formulation with this name already exists' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create formulation' },
      { status: 500 }
    );
  }
}
