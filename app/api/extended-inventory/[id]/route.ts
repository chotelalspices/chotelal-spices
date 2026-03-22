export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email || "" },
    include: { userRoles: { select: { role: true } } },
  });
  return user;
}

// PUT — update (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.status !== "active") return NextResponse.json({ error: "Account inactive" }, { status: 403 });

    const roles = user.userRoles.map((r) => r.role);
    if (!roles.includes("admin")) return NextResponse.json({ error: "Only admins can edit" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { date, companyName, productName, code, price, notes } = body;

    if (!date || !companyName?.trim() || !productName?.trim()) {
      return NextResponse.json({ error: "date, companyName and productName are required" }, { status: 400 });
    }

    const existing = await (prisma as any).extendedInventory.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const updated = await (prisma as any).extendedInventory.update({
      where: { id },
      data: {
        date: new Date(date),
        companyName: companyName.trim(),
        productName: productName.trim(),
        code: code?.trim() || null,
        price: parseFloat(price) || 0,
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json({
      id: updated.id,
      date: updated.date.toISOString().split("T")[0],
      companyName: updated.companyName,
      productName: updated.productName,
      code: updated.code,
      price: updated.price,
      notes: updated.notes,
      updatedAt: updated.updatedAt.toISOString(),
    }, { status: 200 });
  } catch (error) {
    console.error("PUT /api/extended-inventory/[id] error:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

// DELETE (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.status !== "active") return NextResponse.json({ error: "Account inactive" }, { status: 403 });

    const roles = user.userRoles.map((r) => r.role);
    if (!roles.includes("admin")) return NextResponse.json({ error: "Only admins can delete" }, { status: 403 });

    const { id } = await params;
    const existing = await (prisma as any).extendedInventory.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    await (prisma as any).extendedInventory.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/extended-inventory/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}