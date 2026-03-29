export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

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

// GET — list all box types
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || user.status !== "active") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = user.userRoles.map((r) => r.role);
    if (!hasAccess(roles)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const boxTypes = await (prisma as any).boxType.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json(boxTypes, { status: 200 });
  } catch (error) {
    console.error("GET /api/box-inventory error:", error);
    return NextResponse.json({ error: "Failed to fetch box types" }, { status: 500 });
  }
}

// POST — create a new box type (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || user.status !== "active") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const roles = user.userRoles.map((r) => r.role);
    if (!roles.includes("admin")) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const body = await request.json();
    const {
      name,
      costPerUnit,
      minimumStock,
      availableStock,
      description,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // Check duplicate name
    const existing = await (prisma as any).boxType.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: `A box type named "${name.trim()}" already exists.` }, { status: 409 });
    }

    const boxType = await (prisma as any).boxType.create({
  data: {
    name: name.trim(),
    costPerUnit: parseFloat(costPerUnit) || 0,
    minimumStock: parseInt(minimumStock) || 0,
    availableStock: parseInt(availableStock) || 0,
    description: description?.trim() || null,
    status: "active",
  },
});

    return NextResponse.json(boxType, { status: 201 });
  } catch (error) {
    console.error("POST /api/box-inventory error:", error);
    return NextResponse.json({ error: "Failed to create box type" }, { status: 500 });
  }
}