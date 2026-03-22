export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email || "" },
    include: { userRoles: { select: { role: true } } },
  });
  return user;
}

// GET — list all extended inventory items
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.status !== "active") return NextResponse.json({ error: "Account inactive" }, { status: 403 });

    const roles = user.userRoles.map((r) => r.role);
    const isAdmin = roles.includes("admin");
    const hasAccess = isAdmin || roles.includes("research");
    if (!hasAccess) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const items = await (prisma as any).extendedInventory.findMany({
      orderBy: { date: "desc" },
      include: { createdBy: { select: { fullName: true } } },
    });

    // Research role: hide companyName
    const transformed = items.map((item: any) => ({
      id: item.id,
      date: item.date.toISOString().split("T")[0],
      companyName: isAdmin ? item.companyName : null,
      productName: item.productName,
      code: item.code || null,
      price: item.price,
      notes: item.notes || null,
      createdBy: item.createdBy?.fullName || null,
      createdAt: item.createdAt.toISOString(),
    }));

    return NextResponse.json(transformed, { status: 200 });
  } catch (error) {
    console.error("GET /api/extended-inventory error:", error);
    return NextResponse.json({ error: "Failed to fetch extended inventory" }, { status: 500 });
  }
}

// POST — create a new item (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.status !== "active") return NextResponse.json({ error: "Account inactive" }, { status: 403 });

    const roles = user.userRoles.map((r) => r.role);
    const isAdmin = roles.includes("admin");
    if (!isAdmin) return NextResponse.json({ error: "Only admins can create extended inventory items" }, { status: 403 });

    const body = await request.json();
    const { date, companyName, productName, code, price, notes } = body;

    if (!date || !companyName?.trim() || !productName?.trim()) {
      return NextResponse.json({ error: "date, companyName and productName are required" }, { status: 400 });
    }

    const item = await (prisma as any).extendedInventory.create({
      data: {
        date: new Date(date),
        companyName: companyName.trim(),
        productName: productName.trim(),
        code: code?.trim() || null,
        price: parseFloat(price) || 0,
        notes: notes?.trim() || null,
        createdById: user.id,
      },
    });

    return NextResponse.json({
      id: item.id,
      date: item.date.toISOString().split("T")[0],
      companyName: item.companyName,
      productName: item.productName,
      code: item.code,
      price: item.price,
      notes: item.notes,
      createdAt: item.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/extended-inventory error:", error);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}