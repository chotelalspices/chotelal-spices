export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return prisma.user.findUnique({
    where: { email: session.user.email || "" },
    include: { userRoles: { select: { role: true } } },
  });
}

function hasAccess(roles: string[]) {
  return roles.includes("admin") || roles.includes("box_inventory") || roles.includes("packaging");
}

// GET — movement history (optionally filtered by boxTypeId)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.status !== "active") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = user.userRoles.map((r) => r.role);
    if (!hasAccess(roles)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const boxTypeId = searchParams.get("boxTypeId");

    const movements = await (prisma as any).boxMovement.findMany({
      where: boxTypeId ? { boxTypeId } : undefined,
      include: { boxType: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    // Enrich with user names
    const userIds = [...new Set(movements.map((m: any) => m.performedById).filter(Boolean))];
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds as string[] } },
          select: { id: true, fullName: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.fullName]));

    return NextResponse.json(
      movements.map((m: any) => ({
        ...m,
        boxTypeName: m.boxType?.name || "Unknown",
        performedByName: m.performedById ? userMap.get(m.performedById) || "Unknown" : "System",
      })),
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/box-inventory/adjust error:", error);
    return NextResponse.json({ error: "Failed to fetch movements" }, { status: 500 });
  }
}

// POST — adjust stock for a specific box type
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.status !== "active") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = user.userRoles.map((r) => r.role);
    if (!hasAccess(roles)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const body = await request.json();
    const { boxTypeId, action, quantity, reason, reference, remarks } = body;

    if (!boxTypeId) return NextResponse.json({ error: "boxTypeId is required" }, { status: 400 });
    if (!action || !["add", "reduce"].includes(action)) {
      return NextResponse.json({ error: "action must be 'add' or 'reduce'" }, { status: 400 });
    }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: "quantity must be a positive integer" }, { status: 400 });
    }
    if (!reason) return NextResponse.json({ error: "reason is required" }, { status: 400 });

    const boxType = await (prisma as any).boxType.findUnique({ where: { id: boxTypeId } });
    if (!boxType) return NextResponse.json({ error: "Box type not found" }, { status: 404 });

    const newStock = action === "add" ? boxType.availableStock + qty : boxType.availableStock - qty;

    const [movement] = await prisma.$transaction([
      (prisma as any).boxMovement.create({
        data: {
          boxTypeId,
          action,
          quantity: qty,
          reason,
          reference: reference?.trim() || null,
          remarks: remarks?.trim() || null,
          performedById: user.id,
        },
      }),
      (prisma as any).boxType.update({
        where: { id: boxTypeId },
        data: { availableStock: newStock },
      }),
    ]);

    return NextResponse.json({ movement, newStock }, { status: 201 });
  } catch (error) {
    console.error("POST /api/box-inventory/adjust error:", error);
    return NextResponse.json({ error: "Failed to adjust stock" }, { status: 500 });
  }
}