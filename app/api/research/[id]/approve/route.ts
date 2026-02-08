import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user?.email || '' },
      include: {
        userRoles: {
          select: { role: true }
        }
      }
    });

    if (!currentUser || !currentUser.userRoles.some(ur => ur.role === 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { action, rejectionReason } = body;
    const { id } = await params;

    if (action === 'approve') {
      // Approve the research formulation
      const updatedResearch = await prisma.researchFormulation.update({
        where: { id },
        data: {
          status: 'approved',
          reviewedById: currentUser.id,
          reviewedAt: new Date()
        }
      });

      // Get research details with ingredients
      const research = await prisma.researchFormulation.findUnique({
        where: { id },
        include: { ingredients: true }
      });

      if (research) {
        // Check if a formulation with the same name already exists
        const existingFormulation = await prisma.formulation.findFirst({
          where: { name: research.tempName },
          include: { ingredients: true }
        });

        if (existingFormulation) {
          // Replace existing formulation: delete old ingredients and update formulation
          await prisma.formulationIngredient.deleteMany({
            where: { formulationId: existingFormulation.id }
          });

          // Update the existing formulation with new data
          await prisma.formulation.update({
            where: { id: existingFormulation.id },
            data: {
              baseQuantity: research.baseQuantity,
              baseUnit: research.baseUnit,
              status: 'active',
              updatedAt: new Date(),
              ingredients: {
                create: research.ingredients.map(ing => ({
                  rawMaterialId: ing.rawMaterialId,
                  percentage: ing.percentage
                }))
              }
            }
          });
        } else {
          // Create new formulation in main formulations table
          await prisma.formulation.create({
            data: {
              name: research.tempName,
              baseQuantity: research.baseQuantity,
              baseUnit: research.baseUnit,
              defaultQuantity: 100,
              status: 'active',
              ingredients: {
                create: research.ingredients.map(ing => ({
                  rawMaterialId: ing.rawMaterialId,
                  percentage: ing.percentage
                }))
              }
            }
          });
        }
      }

      return NextResponse.json(updatedResearch);
    } else if (action === 'reject') {
      if (!rejectionReason || rejectionReason.trim() === '') {
        return NextResponse.json(
          { error: 'Rejection reason is required' },
          { status: 400 }
        );
      }

      // Reject the research formulation
      const updatedResearch = await prisma.researchFormulation.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedById: currentUser.id,
          reviewedAt: new Date(),
          rejectionReason
        }
      });

      return NextResponse.json(updatedResearch);
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error processing research approval:', error);
    return NextResponse.json(
      { error: 'Failed to process research approval' },
      { status: 500 }
    );
  }
}
