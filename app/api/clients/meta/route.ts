export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

// GET — fetch all client meta records
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const clientMetas = await (prisma as any).clientMeta.findMany({
      orderBy: { clientName: "asc" },
    });

    return NextResponse.json(clientMetas, { status: 200 });
  } catch (error) {
    console.error("GET /api/clients/meta error:", error);
    return NextResponse.json({ error: "Failed to fetch client meta." }, { status: 500 });
  }
}

// POST — upsert city + salesman for a client name
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const { clientName, city, salesman } = body;

    if (!clientName?.trim()) {
      return NextResponse.json({ error: "clientName is required." }, { status: 400 });
    }

    const result = await (prisma as any).clientMeta.upsert({
      where: { clientName: clientName.trim() },
      update: {
        city: city?.trim() || null,
        salesman: salesman?.trim() || null,
      },
      create: {
        clientName: clientName.trim(),
        city: city?.trim() || null,
        salesman: salesman?.trim() || null,
      },
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("POST /api/clients/meta error:", error);
    return NextResponse.json({ error: "Failed to save client meta." }, { status: 500 });
  }
}