export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

function parsePackagedProducts(remarks: string | null) {
  if (!remarks) return [];
  const products: Array<{ name: string; packets: number; weight: number }> = [];
  const productMatches = remarks.match(/([^:]+):\s*\d+\s+packets\s+\(([\d.]+)kg\)/g);

  productMatches?.forEach((match) => {
    const parts = match.match(/([^:]+):\s*(\d+)\s+packets\s+\(([\d.]+)kg\)/);
    if (!parts) return;
    products.push({
      name: parts[1].replace(/^.*Packaged:\s*/i, "").trim(),
      packets: parseInt(parts[2], 10) || 0,
      weight: parseFloat(parts[3]) || 0,
    });
  });

  return products;
}

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
            courierBoxes: true,
            sessionLabels: true,
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
      const packagedProductTotals = new Map<string, { packets: number; totalWeight: number }>();

      batch.packagingSessions.forEach((session) => {
        parsePackagedProducts(session.remarks).forEach((product) => {
          const current = packagedProductTotals.get(product.name) || { packets: 0, totalWeight: 0 };
          packagedProductTotals.set(product.name, {
            packets: current.packets + product.packets,
            totalWeight: current.totalWeight + product.weight,
          });
        });
      });

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
      const latestPackagingSession = batch.packagingSessions.find((session) => {
        const hasItems = session.items.length > 0;
        const hasLabels = session.sessionLabels.length > 0;
        const hasCourierBoxes = session.courierBoxes.length > 0;
        const hasLoss = session.packagingLoss > 0;
        const hasSemiPackaged = session.semiPackaged > 0;
        const hasPackagedRemarks = !!session.remarks && !session.remarks.includes("ready for packaging");

        return hasItems || hasLabels || hasCourierBoxes || hasLoss || hasSemiPackaged || hasPackagedRemarks;
      });

      return {
        batchNumber: batch.batchNumber,
        productName: batch.formulation.name,
        date: latestPackagingSession?.date.toISOString() ?? null,
        producedQuantity: finalOutputKg,
        alreadyPackaged: totalPackagedWeight,
        packagedProducts: Array.from(packagedProductTotals.entries()).map(([name, total]) => ({
          name,
          packets: total.packets,
          totalWeight: total.totalWeight,
        })),
        totalLoss,
        remainingQuantity: Math.max(0, remainingQuantity),
        semiPackaged: batchSemiPackagedKg,
        status,
        sessions,
      };
    });

    formattedBatches.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return NextResponse.json(formattedBatches, { status: 200 });
  } catch (error) {
    console.error("Error fetching packaging batches:", error);
    return NextResponse.json({ error: "Failed to fetch packaging batches" }, { status: 500 });
  }
}
