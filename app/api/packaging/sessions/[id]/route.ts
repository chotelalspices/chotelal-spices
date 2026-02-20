export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to perform this action." },
        { status: 401 }
      );
    }

    const authenticatedUserId = (session.user as any).id as string;

    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: "User ID not found in session." },
        { status: 401 }
      );
    }

    // Verify the user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: authenticatedUserId },
    });

    if (!user || user.status !== "active") {
      return NextResponse.json(
        { error: "User not found or account not active" },
        { status: user ? 403 : 401 }
      );
    }

    // Get session ID from params
    const { id } = await params;

    const body = await request.json();
    const { date } = body;

    // Validate required fields
    if (!date) {
      return NextResponse.json(
        { error: "Missing required field: date" },
        { status: 400 }
      );
    }

    // Validate date format
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    // Check if session exists
    const existingSession = await prisma.packagingSession.findUnique({
      where: { id },
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: "Packaging session not found" },
        { status: 404 }
      );
    }

    // Update the session date
    const updatedSession = await prisma.packagingSession.update({
      where: { id },
      data: { date: parsedDate },
      include: {
        performedBy: {
          select: { fullName: true },
        },
        batch: {
          include: { formulation: true },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        session: {
          id: updatedSession.id,
          date: updatedSession.date.toISOString(),
          batchNumber: updatedSession.batch?.batchNumber || '',
          performedBy: updatedSession.performedBy.fullName,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating packaging session date:", error);
    return NextResponse.json(
      { error: "Failed to update packaging session date" },
      { status: 500 }
    );
  }
}