import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    console.log("Fetching research formulation with ID:", id);

    const research = await prisma.researchFormulation.findUnique({
      where: { id },
      include: {
        ingredients: {
          include: {
            rawMaterial: true
          }
        },
        reviewedBy: {
          select: {
            fullName: true
          }
        }
      }
    });

    if (!research) {
      return NextResponse.json({ error: 'Research formulation not found' }, { status: 404 });
    }

    return NextResponse.json(research);
  } catch (error) {
    console.error('Error fetching research formulation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch research formulation' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tempName, researcherName, researchDate, baseQuantity, baseUnit, notes, ingredients } = body;

    // Validate percentage total
    if (ingredients) {
      const totalPercentage = ingredients.reduce((sum: number, ing: any) => sum + (ing.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return NextResponse.json(
          { error: 'Ingredient percentages must total 100%' },
          { status: 400 }
        );
      }
    }

    // Update research formulation
    const research = await prisma.researchFormulation.update({
      where: { id: (await params).id },
      data: {
        ...(tempName && { tempName }),
        ...(researcherName && { researcherName }),
        ...(researchDate && { researchDate: new Date(researchDate) }),
        ...(baseQuantity && { baseQuantity: parseFloat(baseQuantity) }),
        ...(baseUnit && { baseUnit }),
        ...(notes !== undefined && { notes }),
        ...(ingredients && {
          ingredients: {
            deleteMany: {
              where: { researchId: (await params).id }
            },
            create: ingredients.map((ing: any) => ({
              rawMaterialId: ing.rawMaterialId,
              percentage: parseFloat(ing.percentage)
            }))
          }
        })
      }
    });

    return NextResponse.json(research);
  } catch (error) {
    console.error('Error updating research formulation:', error);
    return NextResponse.json(
      { error: 'Failed to update research formulation' },
      { status: 500 }
    );
  }
}
