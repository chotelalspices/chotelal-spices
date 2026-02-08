import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user info to determine role
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email || '' },
      include: {
        userRoles: {
          select: {
            role: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has research role or is admin
    const userRoles = user.userRoles.map(ur => ur.role);
    const hasResearchAccess = userRoles.includes('research') || userRoles.includes('admin');

    if (!hasResearchAccess) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Build where clause based on user role
    const whereClause = userRoles.includes('admin') ? {} : { researcher: user.fullName };

    const researchFormulations = await prisma.researchFormulation.findMany({
      where: whereClause,
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(researchFormulations);
  } catch (error) {
    console.error('Error fetching research formulations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch research formulations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tempName, researcherName, researchDate, baseQuantity, baseUnit, notes, ingredients } = body;

    // Validate required fields
    if (!tempName || !researcherName || !researchDate || !baseQuantity || !baseUnit) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate ingredients
    if (!ingredients || ingredients.length === 0) {
      return NextResponse.json(
        { error: 'At least one ingredient is required' },
        { status: 400 }
      );
    }

    // Validate percentage total
    const totalPercentage = ingredients.reduce((sum: number, ing: any) => sum + (ing.percentage || 0), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return NextResponse.json(
        { error: 'Ingredient percentages must total 100%' },
        { status: 400 }
      );
    }

    // Create research formulation
    const researchFormulation = await prisma.researchFormulation.create({
      data: {
        tempName,
        researcher: researcherName,
        researchDate: new Date(researchDate),
        baseQuantity: parseFloat(baseQuantity),
        baseUnit,
        notes: notes || '',
        status: 'pending',
        ingredients: {
          create: ingredients.map((ing: any) => ({
            rawMaterialId: ing.rawMaterialId,
            percentage: parseFloat(ing.percentage)
          }))
        }
      }
    });

    return NextResponse.json(researchFormulation, { status: 201 });
  } catch (error) {
    console.error('Error creating research formulation:', error);
    return NextResponse.json(
      { error: 'Failed to create research formulation' },
      { status: 500 }
    );
  }
}
