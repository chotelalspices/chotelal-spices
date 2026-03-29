export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: "Unauthorized", status: 401 };
  const id = (session.user as any).id as string;
  if (!id) return { error: "User ID not found", status: 401 };
  const user = await prisma.user.findUnique({
    where: { id },
    include: { userRoles: { select: { role: true } } },
  });
  if (!user) return { error: "User not found", status: 401 };
  if (user.status !== "active") return { error: "Account inactive", status: 403 };
  const isAdmin = user.userRoles.some((r) => r.role === "admin");
  if (!isAdmin) return { error: "Admin only", status: 403 };
  return { userId: id };
}

// GET — fetch all audit logs
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const logs = await (prisma as any).salesAuditLog.findMany({
      orderBy: { changedAt: "desc" },
      take: 500,
      include: {
        changedBy: { select: { fullName: true } },
      },
    });

    return NextResponse.json(logs, { status: 200 });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}

// POST — create an audit log entry (called internally)
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { userId } = auth;

    const body = await request.json();
    const { salesRecordId, action, changes } = body;

    if (!salesRecordId || !action || !changes) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const log = await (prisma as any).salesAuditLog.create({
      data: {
        salesRecordId,
        changedById: userId,
        action,
        changes,
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Error creating audit log:", error);
    return NextResponse.json({ error: "Failed to create audit log" }, { status: 500 });
  }
}