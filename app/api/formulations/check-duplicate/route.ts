import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json({ error: 'Formulation name is required' }, { status: 400 });
    }

    // Check if a formulation with the same name exists
    const existingFormulation = await prisma.formulation.findFirst({
      where: { 
        name: {
          equals: name,
          mode: 'insensitive' // Case-insensitive comparison
        }
      },
      include: {
        ingredients: {
          include: {
            rawMaterial: {
              select: {
                name: true,
                unit: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json({
      exists: !!existingFormulation,
      formulation: existingFormulation
    });

  } catch (error) {
    console.error('Error checking duplicate formulation:', error);
    return NextResponse.json(
      { error: 'Failed to check for duplicate formulation' },
      { status: 500 }
    );
  }
}
