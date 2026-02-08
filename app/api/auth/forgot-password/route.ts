export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await Promise.race([
      prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 10000)
      )
    ]) as any;

    if (!user) {
      // Don't reveal if email exists or not for security
      return NextResponse.json(
        { message: 'If an account with this email exists, a password reset OTP has been sent.' },
        { status: 200 }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    // Delete any existing OTP for this email
    await Promise.race([
      prisma.passwordResetOTP.deleteMany({
        where: { email: email.toLowerCase() }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 10000)
      )
    ]);

    // Store new OTP
    await Promise.race([
      prisma.passwordResetOTP.create({
        data: {
          email: email.toLowerCase(),
          otp,
          expiresAt
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 10000)
      )
    ]);

    // Send email with OTP
    try {
      const baseUrl = request.nextUrl.origin;
      const emailResponse = await fetch(`${baseUrl}/api/auth/send-otp-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email.toLowerCase(),
          subject: 'Password Reset OTP - SpiceMaster',
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
                <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
                <p style="color: #666; line-height: 1.6;">
                  Hello ${user.fullName},
                </p>
                <p style="color: #666; line-height: 1.6;">
                  We received a request to reset your password for your SpiceMaster account. 
                  Use the OTP below to proceed with the password reset:
                </p>
                <div style="background: #007bff; color: white; padding: 20px; text-align: center; 
                           border-radius: 8px; margin: 30px 0; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
                  ${otp}
                </div>
                <p style="color: #666; line-height: 1.6;">
                  This OTP will expire in <strong>15 minutes</strong>.
                </p>
                <p style="color: #666; line-height: 1.6;">
                  If you didn't request this password reset, please ignore this email. 
                  Your account remains secure.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px; text-align: center;">
                  © 2025 SpiceMaster Industries. All rights reserved.
                </p>
              </div>
            </div>
          `
        })
      });

      if (!emailResponse.ok) {
        console.error('Failed to send OTP email:', await emailResponse.text());
        // Continue with response even if email fails
      }
    } catch (emailError) {
      console.error('Error sending OTP email:', emailError);
      // Continue with response even if email fails
    }

    return NextResponse.json(
      { message: 'If an account with this email exists, a password reset OTP has been sent.' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Forgot password error:', error);
    
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
      { error: 'Failed to process password reset request. Please try again.' },
      { status: 500 }
    );
  }
}
