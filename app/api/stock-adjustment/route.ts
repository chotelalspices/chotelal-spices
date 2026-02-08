export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

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
      materialId,
      adjustmentType,
      quantity,
      reason,
      adjustmentDate,
      remarks,
    } = body;

    // Validate required fields
    if (!materialId || !adjustmentType || !quantity || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: materialId, adjustmentType, quantity, and reason are required' },
        { status: 400 }
      );
    }

    // Validate adjustmentType enum
    if (!['add', 'reduce'].includes(adjustmentType.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid adjustmentType. Must be "add" or "reduce"' },
        { status: 400 }
      );
    }

    // Validate reason enum
    const validReasons = ['purchase', 'wastage', 'damage', 'correction', 'production'];
    if (!validReasons.includes(reason.toLowerCase())) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${validReasons.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate quantity
    const quantityNum = parseFloat(quantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be a positive number' },
        { status: 400 }
      );
    }

    // Check if material exists
    const rawMaterial = await prisma.rawMaterial.findUnique({
      where: { id: materialId },
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

    if (rawMaterial.status !== 'active') {
      return NextResponse.json(
        { error: 'Cannot adjust stock for inactive material' },
        { status: 400 }
      );
    }

    // Calculate current stock
    const currentStock = rawMaterial.stockMovements.reduce((total, movement) => {
      if (movement.action === 'add') {
        return total + movement.quantity;
      } else {
        return total - movement.quantity;
      }
    }, 0);

    // Validate that reducing stock won't go below zero
    if (adjustmentType === 'reduce' && quantityNum > currentStock) {
      return NextResponse.json(
        { 
          error: 'Cannot reduce stock below zero',
          currentStock,
          requestedReduction: quantityNum,
        },
        { status: 400 }
      );
    }

    // Parse adjustment date if provided, otherwise use current date
    let createdAt: Date;
    if (adjustmentDate) {
      createdAt = new Date(adjustmentDate);
      if (isNaN(createdAt.getTime())) {
        return NextResponse.json(
          { error: 'Invalid adjustment date format' },
          { status: 400 }
        );
      }
    } else {
      createdAt = new Date();
    }

    // Create stock movement
    const stockMovement = await prisma.stockMovement.create({
      data: {
        rawMaterialId: materialId,
        action: adjustmentType.toLowerCase() as 'add' | 'reduce',
        quantity: quantityNum,
        reason: reason.toLowerCase() as 'purchase' | 'wastage' | 'damage' | 'correction' | 'production',
        reference: remarks?.trim() || null,
        performedById: authenticatedUserId,
        createdAt,
      },
      include: {
        rawMaterial: {
          select: {
            id: true,
            name: true,
            unit: true,
          },
        },
        performedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    // Calculate new stock after adjustment
    const newStock = adjustmentType === 'add' 
      ? currentStock + quantityNum 
      : currentStock - quantityNum;

    return NextResponse.json(
      {
        id: stockMovement.id,
        rawMaterial: {
          id: stockMovement.rawMaterial.id,
          name: stockMovement.rawMaterial.name,
          unit: stockMovement.rawMaterial.unit,
        },
        action: stockMovement.action,
        quantity: stockMovement.quantity,
        reason: stockMovement.reason,
        reference: stockMovement.reference,
        currentStock,
        newStock,
        performedBy: {
          id: stockMovement.performedBy.id,
          fullName: stockMovement.performedBy.fullName,
        },
        createdAt: stockMovement.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating stock adjustment:', error);
    
    // Handle Prisma validation errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'A stock movement with this reference already exists' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create stock adjustment' },
      { status: 500 }
    );
  }
}

