export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: "Unauthorized. Please log in to perform this action.", status: 401 };
  }
  const authenticatedUserId = (session.user as any).id as string;
  if (!authenticatedUserId) {
    return { error: "User ID not found in session.", status: 401 };
  }
  const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
  if (!user) {
    return { error: "User not found in database.", status: 401 };
  }
  if (user.status !== "active") {
    return { error: "Your account is not active. Please contact an administrator.", status: 403 };
  }
  return { userId: authenticatedUserId };
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthenticatedUser();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: batchId } = await params;

    // Check if batch exists
    const existingBatch = await prisma.productionBatch.findUnique({
      where: { id: batchId },
      include: {
        materialUsages: true,
        packagingSessions: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!existingBatch) {
      return NextResponse.json({ error: "Production batch not found" }, { status: 404 });
    }

    // Check if batch has packaging data
    const hasPackagingSessions = existingBatch.packagingSessions && existingBatch.packagingSessions.length > 0;
    const hasPackagedItems = hasPackagingSessions && 
      existingBatch.packagingSessions.some(session => session.items && session.items.length > 0);

    // Prevent deletion of batches that have packaging data
    if (hasPackagedItems) {
      return NextResponse.json(
        { error: "Cannot delete production batch that has packaging data. Only batches without packaging can be deleted." },
        { status: 400 }
      );
    }

    // Allow deletion of draft batches and confirmed batches without packaging
    if (existingBatch.status === "ready_for_packaging" || existingBatch.status === "confirmed") {
      if (hasPackagedItems) {
        return NextResponse.json(
          { error: "Cannot delete production batch that has packaging data. Only batches without packaging can be deleted." },
          { status: 400 }
        );
      }
    }

    // Delete in transaction to maintain data integrity
    await prisma.$transaction(async (tx) => {
      // Delete related material usages
      await tx.materialUsage.deleteMany({
        where: { batchId },
      });

      // Delete related packaging sessions
      await tx.packagingSession.deleteMany({
        where: { batchId },
      });

      // Delete the production batch
      await tx.productionBatch.delete({
        where: { id: batchId },
      });
    });

    return NextResponse.json(
      { message: "Production batch deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting production batch:", error);
    return NextResponse.json(
      { error: "Failed to delete production batch" },
      { status: 500 }
    );
  }
}
