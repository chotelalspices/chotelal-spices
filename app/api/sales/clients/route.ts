import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Get unique client names from SalesRecord
    const salesClients = await prisma.salesRecord.findMany({
      select: { clientName: true },
      distinct: ['clientName'],
    });

    // Get unique client names from ClientMeta
    const metaClients = await prisma.clientMeta.findMany({
      select: { clientName: true },
    });

    const clientNamesSet = new Set<string>();
    salesClients.forEach((r) => {
      if (r.clientName) clientNamesSet.add(r.clientName.trim());
    });
    metaClients.forEach((m) => {
      if (m.clientName) clientNamesSet.add(m.clientName.trim());
    });

    const sortedClients = Array.from(clientNamesSet).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    return NextResponse.json(sortedClients, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching all clients:", error);
    return NextResponse.json({ error: "Failed to fetch clients: " + error.message }, { status: 500 });
  }
}
