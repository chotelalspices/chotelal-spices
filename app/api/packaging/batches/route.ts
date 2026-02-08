export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to perform this action." },
        { status: 401 }
      );
    }

    // Get the authenticated user's ID
    const authenticatedUserId = (session.user as any).id as string;

    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: "User ID not found in session." },
        { status: 401 }
      );
    }

    // Verify the user exists and is active in the database
    const user = await prisma.user.findUnique({
      where: { id: authenticatedUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found in database." },
        { status: 401 }
      );
    }

    if (user.status !== "active") {
      return NextResponse.json(
        {
          error:
            "Your account is not active. Please contact an administrator.",
        },
        { status: 403 }
      );
    }

    // Fetch all production batches that are ready for packaging or confirmed
    const batches = await prisma.productionBatch.findMany({
      where: {
        status: {
          in: ["ready_for_packaging", "confirmed"],
        },
      },
      include: {
        formulation: true,
        packagingSessions: {
          include: {
            items: {
              include: {
                container: true,
              },
            },
            performedBy: {
              select: {
                fullName: true,
              },
            },
          },
          orderBy: {
            date: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Format batches to match frontend expectations
    const formattedBatches = batches.map((batch) => {
      // Calculate total packaged weight from session remarks
      const totalPackagedWeight = batch.packagingSessions.reduce(
        (sum, session) => {
          if (session.remarks && session.remarks.includes('Total:')) {
            const match = session.remarks.match(/Total:\s*([\d.]+)kg/);
            if (match) {
              return sum + parseFloat(match[1]);
            }
          }
          return sum;
        },
        0
      );

      const totalLoss = batch.packagingSessions.reduce(
        (sum, session) => sum + session.packagingLoss,
        0
      );

      // Get final output quantity (convert to kg if needed)
      const finalOutputKg =
        batch.unit === "kg"
          ? (batch.finalOutput ?? batch.plannedQuantity)
          : (batch.finalOutput ?? batch.plannedQuantity) / 1000;

      const remainingQuantity = finalOutputKg - totalPackagedWeight - totalLoss;

      // Determine status based on how much has been packaged
      let status: "Not Started" | "Partial" | "Completed";
      if (totalPackagedWeight === 0) {
        status = "Not Started";
      } else if (remainingQuantity <= 0.01) {
        // Consider completed if remaining is less than 0.01 kg
        status = "Completed";
      } else {
        status = "Partial";
      }

      // Format sessions (simplified since we're not using PackagedItem)
      const sessions = batch.packagingSessions.map((session) => {
        return {
          id: session.id,
          batchNumber: batch.batchNumber,
          date: session.date.toISOString(),
          items: [], // Empty since we're not using PackagedItem
          packagingLoss: session.packagingLoss,
          totalPackagedWeight: 0, // Can be parsed from remarks if needed
          remarks: session.remarks,
          performedBy: session.performedBy.fullName,
        };
      });

      return {
        batchNumber: batch.batchNumber,
        productName: batch.formulation.name,
        producedQuantity: finalOutputKg,
        alreadyPackaged: totalPackagedWeight,
        totalLoss: totalLoss,
        remainingQuantity: Math.max(0, remainingQuantity),
        status,
        sessions,
      };
    });

    return NextResponse.json(formattedBatches, { status: 200 });
  } catch (error) {
    console.error("Error fetching packaging batches:", error);
    return NextResponse.json(
      { error: "Failed to fetch packaging batches" },
      { status: 500 }
    );
  }
}
