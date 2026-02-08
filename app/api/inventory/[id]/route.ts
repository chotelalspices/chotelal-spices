export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

// GET single raw material by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rawMaterial = await prisma.rawMaterial.findUnique({
      where: { id },
      include: {
        stockMovements: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!rawMaterial) {
      return NextResponse.json(
        { error: 'Raw material not found' },
        { status: 404 }
      );
    }

    // Calculate availableStock from stock movements
    const availableStock = rawMaterial.stockMovements.reduce((total, movement) => {
      if (movement.action === 'add') {
        return total + movement.quantity;
      } else {
        return total - movement.quantity;
      }
    }, 0);

    return NextResponse.json(
      {
        id: rawMaterial.id,
        name: rawMaterial.name,
        unit: rawMaterial.unit.toLowerCase() as 'kg' | 'gm',
        costPerUnit: rawMaterial.costPerUnit,
        availableStock,
        minimumStock: rawMaterial.minimumStock,
        status: rawMaterial.status.toLowerCase() as 'active' | 'inactive',
        description: rawMaterial.description || undefined,
        createdAt: rawMaterial.createdAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching raw material:', error);
    return NextResponse.json(
      { error: 'Failed to fetch raw material' },
      { status: 500 }
    );
  }
}

// PUT/PATCH update raw material
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      costPerUnit,
      minimumStockLevel,
      status,
      description,
    } = body;

    // Check if material exists
    const existingMaterial = await prisma.rawMaterial.findUnique({
      where: { id },
    });

    if (!existingMaterial) {
      return NextResponse.json(
        { error: 'Raw material not found' },
        { status: 404 }
      );
    }

    // Validate required fields
    if (!name || costPerUnit === undefined || minimumStockLevel === undefined || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: name, costPerUnit, minimumStockLevel, and status are required' },
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

    // Update the raw material
    const updatedMaterial = await prisma.rawMaterial.update({
      where: { id },
      data: {
        name: name.trim(),
        costPerUnit: parseFloat(costPerUnit),
        minimumStock: parseFloat(minimumStockLevel),
        status: status.toLowerCase() as 'active' | 'inactive',
        description: description?.trim() || null,
      },
      include: {
        stockMovements: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // Calculate available stock
    const availableStock = updatedMaterial.stockMovements.reduce((total, movement) => {
      if (movement.action === 'add') {
        return total + movement.quantity;
      } else {
        return total - movement.quantity;
      }
    }, 0);

    return NextResponse.json(
      {
        id: updatedMaterial.id,
        name: updatedMaterial.name,
        unit: updatedMaterial.unit.toLowerCase() as 'kg' | 'gm',
        costPerUnit: updatedMaterial.costPerUnit,
        availableStock,
        minimumStock: updatedMaterial.minimumStock,
        status: updatedMaterial.status.toLowerCase() as 'active' | 'inactive',
        description: updatedMaterial.description || undefined,
        createdAt: updatedMaterial.createdAt.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating raw material:', error);
    
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
      { error: 'Failed to update raw material' },
      { status: 500 }
    );
  }
}

// DELETE raw material
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Check if material exists
    const existingMaterial = await prisma.rawMaterial.findUnique({
      where: { id },
      include: {
        stockMovements: true,
        formulationIngredients: true,
        materialUsages: true,
        researchIngredients: true,
      },
    });

    if (!existingMaterial) {
      return NextResponse.json(
        { error: 'Raw material not found' },
        { status: 404 }
      );
    }

    // Check if material is being used in formulations or production
    if (existingMaterial.formulationIngredients.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete material. It is being used in formulations.' },
        { status: 409 }
      );
    }

    if (existingMaterial.materialUsages.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete material. It has been used in production batches.' },
        { status: 409 }
      );
    }

    if (existingMaterial.researchIngredients.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete material. It is being used in research formulations.' },
        { status: 409 }
      );
    }

    // Delete all stock movements first (cascade delete)
    await prisma.stockMovement.deleteMany({
      where: { rawMaterialId: id },
    });

    // Delete the raw material
    await prisma.rawMaterial.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: 'Raw material deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting raw material:', error);
    
    // Handle Prisma foreign key constraint errors
    if (error instanceof Error) {
      if (error.message.includes('Foreign key constraint')) {
        return NextResponse.json(
          { error: 'Cannot delete material. It is being used in other records.' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to delete raw material' },
      { status: 500 }
    );
  }
}
