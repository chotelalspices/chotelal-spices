export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchNumber: string }> }
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

    const { batchNumber } = await params as { batchNumber: string };
    const identifier = decodeURIComponent(batchNumber);

    console.log("identifier", identifier);

    // Fetch the production batch by batch number (primary) or by id (fallback)
    let batch = await prisma.productionBatch.findUnique({
      where: {
        batchNumber: identifier,
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
    });

    if (!batch) {
      batch = await prisma.productionBatch.findUnique({
        where: {
          id: identifier,
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
      });
    }

    if (!batch) {
      return NextResponse.json(
        { error: "Batch not found" },
        { status: 404 }
      );
    }

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

    // Determine status
    let status: "Not Started" | "Partial" | "Completed";
    if (totalPackagedWeight === 0) {
      status = "Not Started";
    } else if (remainingQuantity <= 0.01) {
      // Consider completed if remaining is less than 0.01 kg
      status = "Completed";
    } else {
      status = "Partial";
    }

    // Format sessions
    const sessions = batch.packagingSessions.map((session) => {
      let sessionWeight = 0;
      if (session.remarks && session.remarks.includes('Total:')) {
        const match = session.remarks.match(/Total:\s*([\d.]+)kg/);
        if (match) {
          sessionWeight = parseFloat(match[1]);
        }
      }

      return {
        id: session.id,
        batchNumber: batch?.batchNumber,
        date: session.date.toISOString(),
        items: [], // No PackagedItem records
        packagingLoss: session.packagingLoss,
        totalPackagedWeight: sessionWeight,
        remarks: session.remarks,
        performedBy: session.performedBy.fullName,
      };
    });

    const formattedBatch = {
      batchNumber: batch.batchNumber,
      productName: batch.formulation.name,
      formulationId: batch.formulationId,
      producedQuantity: finalOutputKg,
      alreadyPackaged: totalPackagedWeight,
      totalLoss: totalLoss,
      remainingQuantity: Math.max(0, remainingQuantity),
      status,
      sessions,
    };

    return NextResponse.json(formattedBatch, { status: 200 });
  } catch (error) {
    console.error("Error fetching packaging batch:", error);
    return NextResponse.json(
      { error: "Failed to fetch packaging batch" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ batchNumber: string }> }
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

    const { batchNumber } = await params as { batchNumber: string };
    const identifier = decodeURIComponent(batchNumber);
    const body = await request.json();
    const { items, remarks } = body;

    // Find the production batch
    let batch = await prisma.productionBatch.findUnique({
      where: {
        batchNumber: identifier,
      },
      include: {
        formulation: true,
        packagingSessions: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!batch) {
      batch = await prisma.productionBatch.findUnique({
        where: {
          id: identifier,
        },
        include: {
          formulation: true,
          packagingSessions: {
            include: {
              items: true,
            },
          },
        },
      });
    }

    if (!batch) {
      return NextResponse.json(
        { error: "Batch not found" },
        { status: 404 }
      );
    }

    // Check if batch is already completed
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

    const finalOutputKg =
      batch.unit === "kg"
        ? (batch.finalOutput ?? batch.plannedQuantity)
        : (batch.finalOutput ?? batch.plannedQuantity) / 1000;

    const remainingQuantity = finalOutputKg - totalPackagedWeight - totalLoss;

    if (remainingQuantity <= 0.01) {
      return NextResponse.json(
        { error: "Batch is already completed" },
        { status: 400 }
      );
    }

    // Validate container sizes if items are provided
    let validatedContainers: any[] = [];
    if (items && Array.isArray(items) && items.length > 0) {
      const containerIds = items.map((item: any) => item.containerId);
      validatedContainers = await prisma.containerSize.findMany({
        where: {
          id: {
            in: containerIds,
          },
        },
      });

      if (validatedContainers.length !== containerIds.length) {
        return NextResponse.json(
          { error: "One or more container sizes not found" },
          { status: 404 }
        );
      }
    }

    // Create packaging session with remaining quantity as loss (and items if provided)
    const packagingSession = await prisma.$transaction(async (tx) => {
      // Calculate the actual remaining quantity after adding any items
      let itemsWeight = 0;
      if (items && Array.isArray(items) && items.length > 0) {
        itemsWeight = items.reduce(
          (sum: number, item: any) => sum + parseFloat(item.totalWeight || 0),
          0
        );
      }

      // The loss will be the remaining quantity after accounting for items
      const finalLoss = Math.max(0, remainingQuantity - itemsWeight);

      // Create packaging session
      const session = await tx.packagingSession.create({
        data: {
          batchId: batch?.id ?? "",
          date: new Date(),
          packagingLoss: finalLoss,
          remarks: remarks || "Batch marked as finished - remaining quantity counted as loss",
          performedById: authenticatedUserId,
        },
      });

      // Create packaged items if provided
      if (items && Array.isArray(items) && items.length > 0) {
        // Create packaged items
        for (const item of items) {
          await tx.packagedItem.create({
            data: {
              sessionId: session.id,
              containerId: item.containerId,
              numberOfPackets: parseInt(item.numberOfPackets),
              totalWeight: parseFloat(item.totalWeight),
            },
          });
        }
      }

      return session;
    });

    return NextResponse.json(
      {
        message: "Batch marked as finished successfully",
        remainingQuantity: remainingQuantity,
        lossRecorded: remainingQuantity,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error finishing batch:", error);
    return NextResponse.json(
      { error: "Failed to finish batch" },
      { status: 500 }
    );
  }
}