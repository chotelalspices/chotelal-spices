export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import * as bcrypt from 'bcrypt';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to perform this action.' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: {
        userRoles: {
          select: { role: true }
        }
      }
    });

    if (!currentUser || !currentUser.userRoles.some(ur => ur.role === 'admin')) {
      return NextResponse.json(
        { error: 'Access denied. Admin privileges required.' },
        { status: 403 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          select: { role: true }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const formattedUser = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roles: user.userRoles.map(ur => ur.role as 'admin' | 'production' | 'packaging' | 'sales' | 'research'),
      status: user.status.toLowerCase() as 'active' | 'inactive',
      createdAt: user.createdAt.toISOString(),
      lastLogin: user.lastLogin?.toISOString(),
      mustChangePassword: user.mustChangePassword,
    };

    return NextResponse.json(formattedUser, { status: 200 });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
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
    const { id } = await params;
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to perform this action.' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: {
        userRoles: {
          select: { role: true }
        }
      }
    });

    if (!currentUser || !currentUser.userRoles.some(ur => ur.role === 'admin')) {
      return NextResponse.json(
        { error: 'Access denied. Admin privileges required.' },
        { status: 403 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      fullName,
      phone,
      roles,
      status,
    } = body;

    // Validate required fields
    if (!fullName || !roles || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: fullName, roles, and status are required' },
        { status: 400 }
      );
    }

    // Validate roles array
    if (!Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json(
        { error: 'At least one role must be selected' },
        { status: 400 }
      );
    }

    // Validate role enum values
    const validRoles = ['admin', 'production', 'packaging', 'sales', 'research'];
    const invalidRoles = roles.filter(role => !validRoles.includes(role.toLowerCase()));
    if (invalidRoles.length > 0) {
      return NextResponse.json(
        { error: `Invalid roles: ${invalidRoles.join(', ')}. Valid roles are: ${validRoles.join(', ')}` },
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

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update user and their roles
    const user = await prisma.user.update({
      where: { id },
      data: {
        fullName: fullName.trim(),
        phone: phone?.trim() || null,
        status: status.toLowerCase() as 'active' | 'inactive',
        userRoles: {
          deleteMany: {}, // Remove all existing roles
          create: roles.map((role: string) => ({
            role: role.toLowerCase() as 'admin' | 'production' | 'packaging' | 'sales' | 'research'
          }))
        }
      },
      include: {
        userRoles: {
          select: { role: true }
        }
      }
    });

    const formattedUser = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roles: user.userRoles.map(ur => ur.role as 'admin' | 'production' | 'packaging' | 'sales' | 'research'),
      status: user.status.toLowerCase() as 'active' | 'inactive',
      createdAt: user.createdAt.toISOString(),
      lastLogin: user.lastLogin?.toISOString(),
      mustChangePassword: user.mustChangePassword,
    };

    return NextResponse.json(formattedUser, { status: 200 });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to perform this action.' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: {
        userRoles: {
          select: { role: true }
        }
      }
    });

    if (!currentUser || !currentUser.userRoles.some(ur => ur.role === 'admin')) {
      return NextResponse.json(
        { error: 'Access denied. Admin privileges required.' },
        { status: 403 }
      );
    }

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword) {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password and set mustChangePassword to true
    const user = await prisma.user.update({
      where: { id },
      data: {
        hashedPassword,
        mustChangePassword: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        userRoles: {
          select: { role: true }
        },
        status: true,
        createdAt: true,
        lastLogin: true,
        mustChangePassword: true,
      },
    });

    return NextResponse.json(
      { 
        message: 'Password reset successfully. User will need to change password on next login.',
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
