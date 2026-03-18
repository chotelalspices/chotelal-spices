export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");
  if (!name?.trim()) {
    return NextResponse.json({ exists: false });
  }
  const existing = await prisma.formulation.findFirst({
    where: { name: { equals: name.trim(), mode: "insensitive" } },
  });
  return NextResponse.json({ exists: !!existing });
}