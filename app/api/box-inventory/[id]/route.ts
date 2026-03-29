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

// GET — single box type with recent movements
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user || user.status !== "active") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { id } = await params;
        const boxType = await (prisma as any).boxType.findUnique({ where: { id } });
        if (!boxType) return NextResponse.json({ error: "Box type not found" }, { status: 404 });

        return NextResponse.json(boxType, { status: 200 });
    } catch (error) {
        console.error("GET /api/box-inventory/[id] error:", error);
        return NextResponse.json({ error: "Failed to fetch box type" }, { status: 500 });
    }
}

// PATCH — edit box type details (admin only)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user || user.status !== "active") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const roles = user.userRoles.map((r) => r.role);
        if (!roles.includes("admin")) return NextResponse.json({ error: "Admin only" }, { status: 403 });

        const { id } = await params;
        const body = await request.json();
        const {
            name,
            costPerUnit,
            minimumStock,
            availableStock,
            description,
            status,
        } = body;

        const existing = await (prisma as any).boxType.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: "Box type not found" }, { status: 404 });

        // Check name uniqueness if changing name
        if (name && name.trim() !== existing.name) {
            const dupe = await (prisma as any).boxType.findUnique({ where: { name: name.trim() } });
            if (dupe) return NextResponse.json({ error: `Name "${name.trim()}" already exists.` }, { status: 409 });
        }

        const updated = await (prisma as any).boxType.update({
            where: { id },
            data: {
                ...(name !== undefined && { name: name.trim() }),
                ...(costPerUnit !== undefined && { costPerUnit: parseFloat(costPerUnit) || 0 }),
                ...(minimumStock !== undefined && { minimumStock: parseInt(minimumStock) || 0 }),
                ...(availableStock !== undefined && {
                    availableStock: parseInt(availableStock) || 0,
                }),
                ...(description !== undefined && { description: description?.trim() || null }),
                ...(status !== undefined && { status }),
            },
        });

        return NextResponse.json(updated, { status: 200 });
    } catch (error) {
        console.error("PATCH /api/box-inventory/[id] error:", error);
        return NextResponse.json({ error: "Failed to update box type" }, { status: 500 });
    }
}

// DELETE — delete box type (admin only, only if no stock)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getAuthUser();
        if (!user || user.status !== "active") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const roles = user.userRoles.map((r) => r.role);
        if (!roles.includes("admin")) return NextResponse.json({ error: "Admin only" }, { status: 403 });

        const { id } = await params;
        const existing = await (prisma as any).boxType.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: "Box type not found" }, { status: 404 });

        if (existing.availableStock > 0) {
            return NextResponse.json(
                { error: `Cannot delete "${existing.name}" — it has ${existing.availableStock} boxes in stock. Reduce stock to 0 first.` },
                { status: 400 }
            );
        }

        await (prisma as any).boxType.delete({ where: { id } });
        return NextResponse.json({ message: "Box type deleted successfully" }, { status: 200 });
    } catch (error) {
        console.error("DELETE /api/box-inventory/[id] error:", error);
        return NextResponse.json({ error: "Failed to delete box type" }, { status: 500 });
    }
}