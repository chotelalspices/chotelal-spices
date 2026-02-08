export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    const rawMaterials = await prisma.rawMaterial.findMany({
      include: {
        stockMovements: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate availableStock from stock movements
    const materialsWithStock = rawMaterials.map((material) => {
      const availableStock = material.stockMovements.reduce((total, movement) => {
        if (movement.action === 'add') {
          return total + movement.quantity;
        } else {
          return total - movement.quantity;
        }
      }, 0);

      return {
        id: material.id,
        name: material.name,
        unit: material.unit.toLowerCase() as 'kg' | 'gm',
        costPerUnit: material.costPerUnit,
        availableStock,
        minimumStock: material.minimumStock,
        status: material.status.toLowerCase() as 'active' | 'inactive',
        description: material.description || undefined,
        createdAt: material.createdAt.toISOString(),
      };
    });

    return NextResponse.json(materialsWithStock, { status: 200 });
  } catch (error) {
    console.error('Error fetching raw materials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch raw materials' },
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

    // Get the authenticated user's ID
    const authenticatedUserId = (session.user as any).id as string;
    
    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: 'User ID not found in session.' },
        { status: 401 }
      );
    }

    // Verify the user exists and is active in the database
    const user = await prisma.user.findUnique({
      where: { id: authenticatedUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database.' },
        { status: 401 }
      );
    }

    if (user.status !== 'active') {
      return NextResponse.json(
        { error: 'Your account is not active. Please contact an administrator.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      unit,
      costPerUnit,
      openingStock,
      minimumStockLevel,
      status,
      description,
    } = body;

    // Validate required fields
    if (!name || !unit || costPerUnit === undefined || minimumStockLevel === undefined || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: name, unit, costPerUnit, minimumStockLevel, and status are required' },
        { status: 400 }
      );
    }

    // Validate unit enum
    if (!['kg', 'gm'].includes(unit.toLowerCase())) {
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

    // Create raw material and initial stock movement in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the raw material
      const rawMaterial = await tx.rawMaterial.create({
        data: {
          name: name.trim(),
          unit: unit.toLowerCase() as 'kg' | 'gm',
          costPerUnit: parseFloat(costPerUnit),
          minimumStock: parseFloat(minimumStockLevel),
          status: status.toLowerCase() as 'active' | 'inactive',
          description: description?.trim() || null,
        },
      });

      // Create initial stock movement if opening stock is provided
      if (openingStock !== undefined && openingStock > 0) {
        await tx.stockMovement.create({
          data: {
            rawMaterialId: rawMaterial.id,
            action: 'add',
            quantity: parseFloat(openingStock),
            reason: 'purchase',
            performedById: authenticatedUserId,
          },
        });
      }

      return rawMaterial;
    });

    // Fetch the created material with stock movements to return complete data
    const createdMaterial = await prisma.rawMaterial.findUnique({
      where: { id: result.id },
      include: {
        stockMovements: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!createdMaterial) {
      throw new Error('Failed to fetch created material');
    }

    // Calculate available stock
    const availableStock = createdMaterial.stockMovements.reduce((total, movement) => {
      if (movement.action === 'add') {
        return total + movement.quantity;
      } else {
        return total - movement.quantity;
      }
    }, 0);

    return NextResponse.json(
      {
        id: createdMaterial.id,
        name: createdMaterial.name,
        unit: createdMaterial.unit.toLowerCase() as 'kg' | 'gm',
        costPerUnit: createdMaterial.costPerUnit,
        availableStock,
        minimumStock: createdMaterial.minimumStock,
        status: createdMaterial.status.toLowerCase() as 'active' | 'inactive',
        description: createdMaterial.description || undefined,
        createdAt: createdMaterial.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating raw material:', error);
    
    // Handle Prisma validation errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'A raw material with this name already exists' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create raw material' },
      { status: 500 }
    );
  }
}