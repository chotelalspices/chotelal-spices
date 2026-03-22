export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to perform this action." },
        { status: 401 }
      );
    }
    const authenticatedUserId = (session.user as any).id as string;
    if (!authenticatedUserId) {
      return NextResponse.json({ error: "User ID not found in session." }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
    if (!user) {
      return NextResponse.json({ error: "User not found in database." }, { status: 401 });
    }
    if (user.status !== "active") {
      return NextResponse.json(
        { error: "Your account is not active. Please contact an administrator." },
        { status: 403 }
      );
    }

    const batches = await prisma.productionBatch.findMany({
      where: { status: { in: ["ready_for_packaging", "confirmed"] } },
      include: {
        formulation: true,
        packagingSessions: {
          include: {
            items: { include: { container: true } },
            performedBy: { select: { fullName: true } },
          },
          orderBy: { date: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedBatches = batches.map((batch) => {
      // Fully packaged weight parsed from session remarks
      const totalPackagedWeight = batch.packagingSessions.reduce((sum, session) => {
        if (session.remarks && session.remarks.includes("Total:")) {
          const match = session.remarks.match(/Total:\s*([\d.]+)kg/);
          if (match) return sum + parseFloat(match[1]);
        }
        return sum;
      }, 0);

      const totalLoss = batch.packagingSessions.reduce(
        (sum, session) => sum + session.packagingLoss,
        0
      );

      const finalOutputKg =
        batch.unit === "kg"
          ? (batch.finalOutput ?? batch.plannedQuantity)
          : (batch.finalOutput ?? batch.plannedQuantity) / 1000;

      // Semi-packaged weight stored on the batch record
      const batchSemiPackagedKg = (batch as any).semiPackaged || 0;

      const remainingQuantity =
        finalOutputKg - totalPackagedWeight - totalLoss - batchSemiPackagedKg;

      // ── Status logic (4 states) ─────────────────────────────────────────
      // Replace the status block with:
      // Replace the status logic with:
      let status: "Not Started" | "Partial" | "Semi Packaged" | "Completed";

      if (remainingQuantity <= 0.01 && batchSemiPackagedKg <= 0.01) {
        // BOTH remaining AND semi-packaged must be zero for Completed
        status = "Completed";
      } else if (totalPackagedWeight === 0 && batchSemiPackagedKg === 0) {
        status = "Not Started";
      } else if (batchSemiPackagedKg > 0) {
        // Any pending semi-packaged weight = Semi Packaged status
        status = "Semi Packaged";
      } else {
        status = "Partial";
      }

      const sessions = batch.packagingSessions.map((session) => ({
        id: session.id,
        batchNumber: batch.batchNumber,
        date: session.date.toISOString(),
        items: [],
        packagingLoss: session.packagingLoss,
        totalPackagedWeight: 0,
        remarks: session.remarks,
        performedBy: session.performedBy?.fullName ?? "Unknown",
      }));

      return {
        batchNumber: batch.batchNumber,
        productName: batch.formulation.name,
        producedQuantity: finalOutputKg,
        alreadyPackaged: totalPackagedWeight,
        totalLoss,
        remainingQuantity: Math.max(0, remainingQuantity),
        semiPackaged: batchSemiPackagedKg,
        status,
        sessions,
      };
    });

    return NextResponse.json(formattedBatches, { status: 200 });
  } catch (error) {
    console.error("Error fetching packaging batches:", error);
    return NextResponse.json({ error: "Failed to fetch packaging batches" }, { status: 500 });
  }
}