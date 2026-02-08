export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, newPassword } = body;

    // Validate input
    if (!email || !newPassword) {
      return NextResponse.json(
        { error: 'Email and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Get the user
    const user = await Promise.race([
      prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 10000)
      )
    ]) as any;

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update the password
    await Promise.race([
      prisma.user.update({
        where: { id: user.id },
        data: { 
          hashedPassword: hashedNewPassword,
          mustChangePassword: false
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 10000)
      )
    ]);

    return NextResponse.json(
      { message: 'Password reset successfully. You can now login with your new password.' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Password reset error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Database connection timeout')) {
        return NextResponse.json(
          { error: 'Database connection timeout. Please try again.' },
          { status: 503 }
        );
      }
      
      if (error.message.includes('ETIMEDOUT')) {
        return NextResponse.json(
          { error: 'Database connection timeout. Please try again.' },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to reset password. Please try again.' },
      { status: 500 }
    );
  }
}
