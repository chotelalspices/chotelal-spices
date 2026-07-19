import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import * as XLSX from "xlsx";

async function getAuthUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: "Unauthorized. Please log in.", status: 401 };
  const id = (session.user as any).id as string;
  if (!id) return { error: "User ID not found in session.", status: 401 };
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "User not found in database.", status: 401 };
  if (user.status !== "active") return { error: "Your account is not active.", status: 403 };
  return { userId: id };
}

function getExcelDateSerial(date: Date): number {
  const baseDate = new Date(Date.UTC(1899, 11, 30));
  const diffMs = date.getTime() - baseDate.getTime();
  return diffMs / (24 * 60 * 60 * 1000);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const clientName = searchParams.get("clientName");

    if (!clientName) {
      return NextResponse.json({ error: "Client Name is required." }, { status: 400 });
    }

    // Determine current financial year based on today's date
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0-11
    const currentYear = currentDate.getFullYear();
    const startYear = currentMonth >= 3 ? currentYear : currentYear - 1; // Financial year starts in April (month 3)

    const currentFYStart = new Date(Date.UTC(startYear, 3, 1));
    const currentFYEnd = new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999));

    const prevFYStart = new Date(Date.UTC(startYear - 1, 3, 1));
    const prevFYEnd = new Date(Date.UTC(startYear, 2, 31, 23, 59, 59, 999));

    // Fetch all sales records for the client spanning current and previous financial years
    const salesRecords = await prisma.salesRecord.findMany({
      where: {
        clientName: clientName,
        saleDate: {
          gte: prevFYStart,
          lte: currentFYEnd,
        },
      },
      include: {
        product: true,
      },
    });

    // Group sales records by product name (trimmed)
    const productMap = new Map<string, {
      name: string;
      wgt: number;
      prevYearSale: number;
      monthlySales: number[];
    }>();

    salesRecords.forEach((record) => {
      if (!record.product) return;
      const name = record.product.name.trim();
      const weight = record.product.unit === "gm" ? record.product.quantity / 1000 : record.product.quantity;

      if (!productMap.has(name)) {
        productMap.set(name, {
          name: record.product.name,
          wgt: weight,
          prevYearSale: 0,
          monthlySales: Array(12).fill(0),
        });
      }

      const productData = productMap.get(name)!;
      const saleTime = new Date(record.saleDate).getTime();

      if (saleTime >= prevFYStart.getTime() && saleTime <= prevFYEnd.getTime()) {
        productData.prevYearSale += record.quantitySold;
      } else if (saleTime >= currentFYStart.getTime() && saleTime <= currentFYEnd.getTime()) {
        // Calculate index relative to April (0 = April, 11 = March)
        const recordMonth = new Date(record.saleDate).getMonth();
        const monthIdx = (recordMonth - 3 + 12) % 12;
        productData.monthlySales[monthIdx] += record.quantitySold;
      }
    });

    // Filter out products with 0 sales in both years (as requested by the user)
    const activeProducts = Array.from(productMap.values()).filter((p) => {
      const currentYearTotal = p.monthlySales.reduce((sum, q) => sum + q, 0);
      return p.prevYearSale > 0 || currentYearTotal > 0;
    });

    // Sort products by formulation name alphabetically, then by packet size/quantity numerically
    activeProducts.sort((a, b) => {
      const aParts = a.name.split(" ");
      const bParts = b.name.split(" ");

      const aFormulation = aParts.slice(0, -1).join(" ");
      const bFormulation = bParts.slice(0, -1).join(" ");

      const aQuantity = aParts[aParts.length - 1];
      const bQuantity = bParts[bParts.length - 1];

      if (aFormulation.toLowerCase() < bFormulation.toLowerCase()) return -1;
      if (aFormulation.toLowerCase() > bFormulation.toLowerCase()) return 1;

      const aNum = parseInt(aQuantity.replace(/\D/g, "")) || 0;
      const bNum = parseInt(bQuantity.replace(/\D/g, "")) || 0;

      return aNum - bNum;
    });

    // Build worksheet data arrays
    const wsData: any[][] = [];

    // Row 1: Header/Title
    wsData.push([`${clientName} & DIRECT PARTY- ${startYear}-${startYear + 1}`]);

    // Row 2: Sub-headers (containing previous year labels and date serials)
    const prevYearShort = `${(startYear - 1) % 100}-${startYear % 100}`;
    const row2: any[] = [
      null,
      "(gm)",
      `${prevYearShort} SALE`,
      `AVG.        ${prevYearShort}`,
    ];

    // Add Excel dates representing months (Apr to Mar)
    for (let m = 0; m < 12; m++) {
      const monthIndex = (3 + m) % 12;
      const yearOffset = Math.floor((3 + m) / 12);
      const date = new Date(Date.UTC(startYear + yearOffset, monthIndex, 1));
      row2.push(getExcelDateSerial(date));
    }
    row2.push("TOTAL", "GROWTH", "AVG");
    wsData.push(row2);

    // Row 3: Column types
    const row3 = [
      "PRODUCT  NAME",
      "WGT",
      null,
      null,
    ];
    for (let m = 0; m < 12; m++) {
      row3.push("QTY");
    }
    row3.push("QTY", null, null);
    wsData.push(row3);

    // Product rows (Row 4 onwards)
    activeProducts.forEach((p) => {
      wsData.push([
        p.name,
        p.wgt,
        p.prevYearSale,
        0, // placeholder for D (AVG C)
        ...p.monthlySales.map((q) => (q > 0 ? q : null)),
        0, // placeholder for Q (TOTAL)
        0, // placeholder for R (GROWTH)
        0, // placeholder for S (AVG)
      ]);
    });

    // Empty separator row
    wsData.push([]);

    // Total row
    const totalRow = [
      "TOTAL",
      null,
      0, // placeholder for C sum
      0, // placeholder for D sum
    ];
    for (let m = 0; m < 12; m++) {
      totalRow.push(0); // placeholder for monthly sums
    }
    totalRow.push(0, null, null); // placeholder for Q sum
    wsData.push(totalRow);

    // Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const startRow = 4; // Excel row 4 (1-indexed)
    const endRow = startRow + activeProducts.length - 1;

    // Apply number formats for months (Apr-26, May-26, etc.) on Row 2
    for (let colIdx = 4; colIdx <= 15; colIdx++) {
      const cellRef = XLSX.utils.encode_cell({ r: 1, c: colIdx });
      if (ws[cellRef]) {
        ws[cellRef].t = "n";
        ws[cellRef].z = "mmm-yy";
      }
    }

    // Populate formulas & formatting for product rows
    activeProducts.forEach((p, idx) => {
      const r = startRow + idx; // Excel row number (1-indexed)

      // Col D: Average Prev Year = C/12
      const cellD = XLSX.utils.encode_cell({ r: r - 1, c: 3 });
      ws[cellD] = { t: "n", f: `C${r}/12` };

      // Col Q: Current Year Total = SUM(E:P)
      const cellQ = XLSX.utils.encode_cell({ r: r - 1, c: 16 });
      ws[cellQ] = { t: "n", f: `SUM(E${r}:P${r})` };

      // Col R: Growth = Q - C (Positive if growth, negative if loss)
      const cellR = XLSX.utils.encode_cell({ r: r - 1, c: 17 });
      ws[cellR] = { t: "n", f: `Q${r}-C${r}` };

      // Col S: Current Year Avg = Q/12
      const cellS = XLSX.utils.encode_cell({ r: r - 1, c: 18 });
      ws[cellS] = { t: "n", f: `Q${r}/12` };

      // Set decimal format for weight (Col B)
      const cellB = XLSX.utils.encode_cell({ r: r - 1, c: 1 });
      if (ws[cellB]) {
        ws[cellB].z = "0.000";
      }
    });

    // Populate formulas for Total Row
    const totalRowR = endRow + 1; // 0-indexed row index of TOTAL row (starts at endRow + 2 in 1-indexed)
    const totalRowIdx = totalRowR + 1;

    // C Total = SUM(C4:C[endRow])
    ws[XLSX.utils.encode_cell({ r: totalRowR, c: 2 })] = { t: "n", f: `SUM(C4:C${endRow})` };
    // D Total = SUM(D4:D[endRow])
    ws[XLSX.utils.encode_cell({ r: totalRowR, c: 3 })] = { t: "n", f: `SUM(D4:D${endRow})` };

    // E to P Monthly Totals
    for (let colIdx = 4; colIdx <= 15; colIdx++) {
      const colLetter = XLSX.utils.encode_col(colIdx);
      ws[XLSX.utils.encode_cell({ r: totalRowR, c: colIdx })] = { t: "n", f: `SUM(${colLetter}4:${colLetter}${endRow})` };
    }
    // Q Total = SUM(Q4:Q[endRow])
    ws[XLSX.utils.encode_cell({ r: totalRowR, c: 16 })] = { t: "n", f: `SUM(Q4:Q${endRow})` };

    // Set layout properties: cell merges
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 18 } }, // A1 to S1
      { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } }, // C2 to C3
      { s: { r: 1, c: 3 }, e: { r: 2, c: 3 } }, // D2 to D3
    ];

    // Set column widths
    ws["!cols"] = [
      { wch: 54 }, // A (Product Name)
      { wch: 6 },  // B (Weight)
      { wch: 8 },  // C (Prev Sale)
      { wch: 10 }, // D (Prev Avg)
      { wch: 8 },  // E (Apr)
      { wch: 8 },  // F (May)
      { wch: 8 },  // G (Jun)
      { wch: 8 },  // H (Jul)
      { wch: 8 },  // I (Aug)
      { wch: 8 },  // J (Sep)
      { wch: 8 },  // K (Oct)
      { wch: 8 },  // L (Nov)
      { wch: 8 },  // M (Dec)
      { wch: 8 },  // N (Jan)
      { wch: 8 },  // O (Feb)
      { wch: 8 },  // P (Mar)
      { wch: 10 }, // Q (Total)
      { wch: 10 }, // R (Growth)
      { wch: 8 },  // S (Avg)
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ANNUAL SALE");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const safeClientName = clientName.replace(/[^a-zA-Z0-9]/g, "_");
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeClientName}_ANNUAL_SALES.xlsx"`,
      },
    });

  } catch (error: any) {
    console.error("Error generating annual report:", error);
    return NextResponse.json({ error: "Failed to generate report: " + error.message }, { status: 500 });
  }
}
