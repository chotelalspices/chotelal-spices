import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get current user with roles
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        userRoles: {
          select: { role: true }
        }
      },
      take: 5 // Just first 5 for debugging
    });

    const debugInfo = users.map(user => ({
      email: user.email,
      oldRole: null, // Old role field no longer exists
      newRoles: user.userRoles.map(ur => ur.role),
      hasRoles: user.userRoles.length > 0
    }));

    return NextResponse.json(debugInfo);
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: 'Debug failed' }, { status: 500 });
  }
}
