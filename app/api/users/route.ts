export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import * as bcrypt from 'bcrypt';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
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

    const users = await prisma.user.findMany({
      include: {
        userRoles: {
          select: { role: true }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedUsers = users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roles: user.userRoles.map(ur => ur.role as 'admin' | 'production' | 'packaging' | 'sales' | 'research'),
      status: user.status.toLowerCase() as 'active' | 'inactive',
      createdAt: user.createdAt.toISOString(),
      lastLogin: user.lastLogin?.toISOString(),
      mustChangePassword: user.mustChangePassword,
    }));

    return NextResponse.json(formattedUsers, { status: 200 });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
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

    const body = await request.json();
    const {
      fullName,
      email,
      phone,
      tempPassword,
      roles,
      status,
    } = body;

    // Validate required fields
    if (!fullName || !email || !tempPassword || !roles || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: fullName, email, tempPassword, roles, and status are required' },
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
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

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Create the user with roles
    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: email.toLowerCase(),
        phone: phone?.trim() || null,
        hashedPassword,
        status: status.toLowerCase() as 'active' | 'inactive',
        mustChangePassword: true,
        userRoles: {
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

    return NextResponse.json(formattedUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    
    // Handle Prisma validation errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
