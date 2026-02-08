export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to perform this action." },
        { status: 401 }
      );
    }

    // Get the authenticated user's ID
    const authenticatedUserId = (session.user as any).id as string;

    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: "User ID not found in session." },
        { status: 401 }
      );
    }

    // Verify the user exists and is active in the database
    const user = await prisma.user.findUnique({
      where: { id: authenticatedUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found in database." },
        { status: 401 }
      );
    }

    if (user.status !== "active") {
      return NextResponse.json(
        {
          error:
            "Your account is not active. Please contact an administrator.",
        },
        { status: 403 }
      );
    }

    // Fetch all container sizes
    const containers = await prisma.containerSize.findMany({
      orderBy: {
        size: "asc",
      },
    });

    // Format to match frontend expectations
    const formattedContainers = containers.map((container) => ({
      id: container.id,
      size: container.size,
      label: container.label,
    }));

    return NextResponse.json(formattedContainers, { status: 200 });
  } catch (error) {
    console.error("Error fetching container sizes:", error);
    return NextResponse.json(
      { error: "Failed to fetch container sizes" },
      { status: 500 }
    );
  }
}
