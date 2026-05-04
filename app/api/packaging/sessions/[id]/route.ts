export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";

const parseProductsFromRemarks = (remarks: string | null) => {
  if (!remarks) return [];
  const products: Array<{ name: string; packets: number; weight: number }> = [];
  const productMatches = remarks.match(/([^:]+):\s*(\d+)\s+packets\s+\(([\d.]+)kg\)/g);
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
};

async function getActiveUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: "Unauthorized. Please log in to perform this action.", status: 401 };

  const authenticatedUserId = (session.user as any).id as string;
  if (!authenticatedUserId) return { error: "User ID not found in session.", status: 401 };

  const user = await prisma.user.findUnique({ where: { id: authenticatedUserId } });
  if (!user || user.status !== "active") {
    return { error: "User not found or account not active", status: user ? 403 : 401 };
  }

  return { userId: authenticatedUserId };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getActiveUser();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { userId } = auth;

    const { id } = await params;
    const body = await request.json();
    const { date, products, labels, packagingLoss, remarks } = body;

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

    const existingSession = await prisma.packagingSession.findUnique({
      where: { id },
      include: {
        batch: {
          include: {
            packagingSessions: true,
          },
        },
        sessionLabels: true,
      },
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: "Packaging session not found" },
        { status: 404 }
      );
    }

    if (!Array.isArray(products) && !Array.isArray(labels) && packagingLoss === undefined && remarks === undefined) {
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
            performedBy: updatedSession.performedBy?.fullName ?? null,
          },
        },
        { status: 200 }
      );
    }

    const currentProducts = parseProductsFromRemarks(existingSession.remarks);
    const nextProducts: Array<{ name: string; packets: number; weight: number }> = Array.isArray(products)
      ? products.map((product: any) => ({
          name: String(product.name || "").trim(),
          packets: Math.max(0, parseInt(product.packets, 10) || 0),
          weight: Math.max(0, parseFloat(product.weight) || 0),
        })).filter((product) => product.name)
      : currentProducts;

    const currentProductMap = new Map(currentProducts.map((product) => [product.name, product]));
    const nextProductMap = new Map(nextProducts.map((product) => [product.name, product]));

    const productNames = [...new Set([...currentProductMap.keys(), ...nextProductMap.keys()])];
    const nextSessionWeight = nextProducts.reduce((sum, product) => sum + product.weight, 0);
    const nextSessionLoss = packagingLoss === undefined ? existingSession.packagingLoss : Math.max(0, parseFloat(packagingLoss) || 0);
    const finalOutputKg =
      existingSession.batch.unit === "kg"
        ? (existingSession.batch.finalOutput ?? existingSession.batch.plannedQuantity)
        : (existingSession.batch.finalOutput ?? existingSession.batch.plannedQuantity) / 1000;
    const otherPackagedWeight = existingSession.batch.packagingSessions.reduce((sum, session) => {
      if (session.id === existingSession.id) return sum;
      const match = session.remarks?.match(/Total:\s*([\d.]+)kg/);
      return sum + (match ? parseFloat(match[1]) || 0 : 0);
    }, 0);
    const otherLoss = existingSession.batch.packagingSessions.reduce(
      (sum, session) => session.id === existingSession.id ? sum : sum + session.packagingLoss,
      0
    );
    const availableBulkForSession = finalOutputKg - otherPackagedWeight - otherLoss - (existingSession.batch.semiPackaged || 0);
    if (nextSessionWeight + nextSessionLoss > availableBulkForSession + 0.001) {
      return NextResponse.json(
        {
          error: `Packaging exceeds available bulk quantity. Available: ${availableBulkForSession.toFixed(3)} kg, Requested: ${(nextSessionWeight + nextSessionLoss).toFixed(3)} kg.`,
        },
        { status: 400 }
      );
    }

    const finishedProducts = productNames.length > 0
      ? await prisma.finishedProduct.findMany({
          where: {
            formulationId: existingSession.batch.formulationId,
            name: { in: productNames },
          },
        })
      : [];
    const finishedProductMap = new Map(finishedProducts.map((product) => [product.name, product]));

    const nextLabels: Array<{ type: string; quantity: number; boxTypeId?: string | null; boxesUsed?: number; semiPackaged?: boolean }> = Array.isArray(labels)
      ? labels.map((label: any) => ({
          type: String(label.type || "").trim(),
          quantity: Math.max(0, parseInt(label.quantity, 10) || 0),
          boxTypeId: label.boxTypeId || null,
          boxesUsed: Math.max(0, parseInt(label.boxesUsed, 10) || 0),
          semiPackaged: !!label.semiPackaged,
        })).filter((label) => label.type)
      : existingSession.sessionLabels.map((label) => ({
          type: label.type,
          quantity: label.quantity,
          boxTypeId: label.boxTypeId,
          boxesUsed: label.boxesUsed ?? 0,
          semiPackaged: label.semiPackaged,
        }));

    for (const nextProduct of nextProducts) {
      const oldProduct = currentProductMap.get(nextProduct.name);
      const deltaPackets = nextProduct.packets - (oldProduct?.packets || 0);
      const product = finishedProductMap.get(nextProduct.name);
      if (deltaPackets < 0 && product && (product.availableInventory || 0) < Math.abs(deltaPackets)) {
        return NextResponse.json(
          { error: `Cannot decrease "${nextProduct.name}" by ${Math.abs(deltaPackets)} packets because only ${product.availableInventory || 0} packets are currently available.` },
          { status: 400 }
        );
      }
    }

    for (const nextLabel of nextLabels) {
      if (nextLabel.semiPackaged) continue;
      const currentLabel = existingSession.sessionLabels.find((label) => label.type === nextLabel.type && label.semiPackaged === nextLabel.semiPackaged);
      const labelDelta = nextLabel.quantity - (currentLabel?.quantity || 0);
      if (labelDelta > 0) {
        const labelRecord = await (prisma as any).label.findFirst({
          where: { name: { equals: nextLabel.type.trim(), mode: "insensitive" } },
          include: { labelMovements: true },
        });
        if (!labelRecord) {
          return NextResponse.json({ error: `Label "${nextLabel.type}" not found.` }, { status: 404 });
        }
        const currentStock = labelRecord.labelMovements.reduce(
          (sum: number, movement: any) => movement.action === "add" ? sum + movement.quantity : sum - movement.quantity,
          0
        );
        if (currentStock < labelDelta) {
          return NextResponse.json(
            { error: `Insufficient label stock for "${nextLabel.type}". Available: ${currentStock}, Required: ${labelDelta}.` },
            { status: 400 }
          );
        }
      }

      const oldBoxes = currentLabel?.boxesUsed || 0;
      const boxDelta = (nextLabel.boxesUsed || 0) - oldBoxes;
      if (boxDelta > 0 && nextLabel.boxTypeId) {
        const boxType = await (prisma as any).boxType.findUnique({ where: { id: nextLabel.boxTypeId } });
        if (!boxType) return NextResponse.json({ error: "Box type not found." }, { status: 404 });
        if (boxType.availableStock < boxDelta) {
          return NextResponse.json(
            { error: `Insufficient box stock for "${boxType.name}". Available: ${boxType.availableStock}, Required: ${boxDelta}.` },
            { status: 400 }
          );
        }
      }
    }

    const updatedSession = await prisma.$transaction(async (tx) => {
      for (const productName of productNames) {
        const currentProduct = currentProductMap.get(productName);
        const nextProduct = nextProductMap.get(productName);
        const deltaPackets = (nextProduct?.packets || 0) - (currentProduct?.packets || 0);
        const product = finishedProductMap.get(productName);
        if (product && deltaPackets !== 0) {
          await tx.finishedProduct.update({
            where: { id: product.id },
            data: { availableInventory: (product.availableInventory || 0) + deltaPackets },
          });
        }
      }

      for (const nextLabel of nextLabels) {
        const currentLabel = existingSession.sessionLabels.find((label) => label.type === nextLabel.type && label.semiPackaged === nextLabel.semiPackaged);
        const labelDelta = nextLabel.quantity - (currentLabel?.quantity || 0);
        const boxesDelta = (nextLabel.boxesUsed || 0) - (currentLabel?.boxesUsed || 0);

        if (!nextLabel.semiPackaged && labelDelta !== 0) {
          const labelRecord = await (tx as any).label.findFirst({
            where: { name: { equals: nextLabel.type.trim(), mode: "insensitive" } },
          });
          if (labelRecord) {
            await tx.labelMovement.create({
              data: {
                labelId: labelRecord.id,
                action: labelDelta > 0 ? "reduce" : "add",
                quantity: Math.abs(labelDelta),
                reason: "correction",
                remarks: `Packaging session edit ${existingSession.batch.batchNumber}`,
                adjustmentDate: new Date(),
                performedById: userId,
              },
            });
          }
        }

        if (!nextLabel.semiPackaged && nextLabel.boxTypeId && boxesDelta !== 0) {
          const boxType = await (tx as any).boxType.findUnique({ where: { id: nextLabel.boxTypeId } });
          if (boxType) {
            await Promise.all([
              (tx as any).boxType.update({
                where: { id: nextLabel.boxTypeId },
                data: { availableStock: boxType.availableStock - boxesDelta },
              }),
              (tx as any).boxMovement.create({
                data: {
                  boxTypeId: nextLabel.boxTypeId,
                  action: boxesDelta > 0 ? "reduce" : "add",
                  quantity: Math.abs(boxesDelta),
                  reason: "correction",
                  reference: existingSession.batch.batchNumber,
                  remarks: `Packaging session edit`,
                  performedById: userId,
                },
              }),
            ]);
          }
        }

        if (currentLabel) {
          await tx.sessionLabel.update({
            where: { id: currentLabel.id },
            data: {
              quantity: nextLabel.quantity,
              boxTypeId: nextLabel.semiPackaged ? null : nextLabel.boxTypeId,
              boxesUsed: nextLabel.semiPackaged ? 0 : (nextLabel.boxesUsed || 0),
            },
          });
        }
      }

      const totalWeight = nextProducts.reduce((sum, product) => sum + product.weight, 0);
      const nextRemarks = nextProducts.length > 0
        ? `${remarks || ""} Packaged: ${nextProducts.map((product) => `${product.name}: ${product.packets} packets (${product.weight}kg)`).join(", ")}. Total: ${totalWeight}kg${existingSession.remarks?.includes("(conversion)") ? " (conversion)" : ""}`.trim()
        : remarks || existingSession.remarks;

      return tx.packagingSession.update({
        where: { id },
        data: {
          date: parsedDate,
          packagingLoss: packagingLoss === undefined ? existingSession.packagingLoss : Math.max(0, parseFloat(packagingLoss) || 0),
          remarks: nextRemarks,
        },
        include: {
          performedBy: { select: { fullName: true } },
          batch: { include: { formulation: true } },
          sessionLabels: true,
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        session: {
          id: updatedSession.id,
          date: updatedSession.date.toISOString(),
          batchNumber: updatedSession.batch?.batchNumber || "",
          performedBy: updatedSession.performedBy?.fullName ?? null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating packaging session date:", error);
    return NextResponse.json(
      { error: "Failed to update packaging session" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getActiveUser();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;

    const existingSession = await prisma.packagingSession.findUnique({
      where: { id },
      include: {
        items: true,
        sessionLabels: true,
        courierBoxes: true,
      },
    });

    if (!existingSession) {
      return NextResponse.json({ error: "Packaging session not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.packagedItem.deleteMany({ where: { sessionId: id } });
      await tx.sessionLabel.deleteMany({ where: { sessionId: id } });
      await tx.courierBox.deleteMany({ where: { sessionId: id } });
      await tx.packagingSession.delete({ where: { id } });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting packaging session:", error);
    return NextResponse.json(
      { error: "Failed to delete packaging session" },
      { status: 500 }
    );
  }
}
