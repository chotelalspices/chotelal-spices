export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // ✅ Changed to Promise
) {
  try {
    // 1️⃣ Auth check
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const authenticatedUserId = (session.user as any).id as string;

    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: "User ID missing in session." },
        { status: 401 }
      );
    }

    // 2️⃣ User validation
    const user = await prisma.user.findUnique({
      where: { id: authenticatedUserId },
      select: { status: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 401 }
      );
    }

    if (user.status !== "active") {
      return NextResponse.json(
        { error: "User account is not active." },
        { status: 403 }
      );
    }

    // 3️⃣ Params - ✅ AWAIT params
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Sales record ID is required." },
        { status: 400 }
      );
    }

    // 4️⃣ Body
    const body = await request.json();
    const { paymentStatus, amountPaid, paymentNote } = body;

    if (!paymentStatus || amountPaid === undefined) {
      return NextResponse.json(
        { error: "paymentStatus and amountPaid are required." },
        { status: 400 }
      );
    }

    if (!["paid", "unpaid", "partial"].includes(paymentStatus)) {
      return NextResponse.json(
        { error: "Invalid paymentStatus value." },
        { status: 400 }
      );
    }

    const parsedAmount = Number(amountPaid);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json(
        { error: "amountPaid must be a non-negative number." },
        { status: 400 }
      );
    }

    // 5️⃣ Sales record lookup
    const existingSale = await prisma.salesRecord.findUnique({
      where: { id },
    });

    if (!existingSale) {
      return NextResponse.json(
        { error: "Sales record not found." },
        { status: 404 }
      );
    }

    // 6️⃣ Total calculation
    const totalAmount =
      existingSale.quantitySold *
      existingSale.sellingPrice *
      (1 - (existingSale.discount ?? 0) / 100);

    if (parsedAmount > totalAmount) {
      return NextResponse.json(
        {
          error: `Amount paid (${parsedAmount}) exceeds total (${totalAmount}).`,
        },
        { status: 400 }
      );
    }

    // 7️⃣ Update
    const updatedSale = await prisma.salesRecord.update({
      where: { id },
      data: {
        paymentStatus,
        amountPaid: parsedAmount,
        amountDue: totalAmount - parsedAmount,
        paymentNote: paymentNote || null,
        paymentUpdatedAt: new Date(),
      },
      select: {
        id: true,
        paymentStatus: true,
        amountPaid: true,
        amountDue: true,
      },
    });

    // 8️⃣ Response
    return NextResponse.json(
      {
        success: true,
        sale: {
          id: updatedSale.id,
          paymentStatus: updatedSale.paymentStatus,
          amountPaid: updatedSale.amountPaid,
          amountDue: updatedSale.amountDue,
          totalAmount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("PATCH /sales error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}