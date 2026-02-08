export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    // Validate input
    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Find OTP record
    const otpRecord = await Promise.race([
      prisma.passwordResetOTP.findUnique({
        where: { email: email.toLowerCase() }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 10000)
      )
    ]) as any;

    if (!otpRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      // Delete expired OTP
      await Promise.race([
        prisma.passwordResetOTP.delete({
          where: { email: email.toLowerCase() }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database connection timeout')), 10000)
        )
      ]);
      
      return NextResponse.json(
        { error: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      return NextResponse.json(
        { error: 'Invalid OTP' },
        { status: 400 }
      );
    }

    // OTP is valid, delete it to prevent reuse
    await Promise.race([
      prisma.passwordResetOTP.delete({
        where: { email: email.toLowerCase() }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 10000)
      )
    ]);

    return NextResponse.json(
      { message: 'OTP verified successfully. You can now reset your password.' },
      { status: 200 }
    );

  } catch (error) {
    console.error('OTP verification error:', error);
    
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
      { error: 'Failed to verify OTP. Please try again.' },
      { status: 500 }
    );
  }
}
