export const runtime = "nodejs";

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { validateExcelRow } from '@/data/salesData';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

/**
 * Extracts sales data from Excel files and converts to structured JSON format
 * @param {any} workbook - XLSX workbook object
 * @returns {Array} Array of objects with date, name, and sales details
 */
function extractSalesData(workbook: any) {
    try {
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON (array of arrays)
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];
        
        const results: any[] = [];
        let currentEntry: any = null;
        let currentSales: any[] = [];
        
        // Process each row
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            
            // Skip empty rows
            if (!row || row.every((cell: any) => cell === null || cell === '')) {
                continue;
            }
            
            // Check if this is a date row (starts with a date in first column)
            const firstCell = row[0];
            const isDateRow = firstCell instanceof Date || 
                             (typeof firstCell === 'number' && firstCell > 40000) || // Excel date serial
                             (typeof firstCell === 'string' && /^\d{1,2}[-\/]\w{3}[-\/]\d{2,4}/.test(firstCell));
            
            if (isDateRow) {
                // Save previous entry if exists
                if (currentEntry && currentSales.length > 0) {
                    currentEntry.sales = [...currentSales];
                    results.push(currentEntry);
                }
                
                // Start new entry
                let dateValue: string;
                if (firstCell instanceof Date) {
                    dateValue = firstCell.toISOString().split('T')[0];
                } else if (typeof firstCell === 'number') {
                    // Convert Excel serial date to JavaScript Date
                    const excelDate = XLSX.SSF.parse_date_code(firstCell);
                    dateValue = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
                } else {
                    dateValue = firstCell;
                }
                
                currentEntry = {
                    date: dateValue,
                    name: row[1] || '',
                    voucherType: row[6] || '',
                    voucherNo: row[7] || '',
                    totalAmount: row[8] || 0
                };
                currentSales = [];
            } 
            // Check if this is a product row (has product name and quantity)
            else if (row[1] && typeof row[2] === 'number' && typeof row[3] === 'number') {
                const product = {
                    product: row[1],
                    pieces: row[2],
                    pricePerPiece: row[3],
                    totalPrice: row[4] || (row[2] * row[3])
                };
                currentSales.push(product);
            }
        }
        
        // Don't forget the last entry
        if (currentEntry && currentSales.length > 0) {
            currentEntry.sales = [...currentSales];
            results.push(currentEntry);
        }
        
        return results;
        
    } catch (error) {
        console.error(`Error processing workbook:`, error);
        return [];
    }
}

async function getFinishedProducts() {
  try {
    // Fetch all finished products with their relations (same logic as /api/sales/products)
    const finishedProducts = await prisma.finishedProduct.findMany({
      include: {
        formulation: {
          include: {
            productionBatches: {
              include: {
                materialUsages: {
                  include: {
                    rawMaterial: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Process finished products to calculate available quantities and costs
    const availableProducts = finishedProducts.map((product) => {
      const availableQuantity = product.availableInventory || 0;

      // Use the product's actual quantity and unit instead of parsing the name
      let productionCostPerPacket = 0;
      
      // Get the most recent batch for this formulation to calculate cost
      const recentBatch = product.formulation.productionBatches
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      if (recentBatch && recentBatch.materialUsages.length > 0) {
        const totalProductionCost = recentBatch.materialUsages.reduce(
          (sum: number, usage: any) => sum + usage.cost,
          0
        );
        
        const finalOutputKg =
          recentBatch.unit === "kg"
            ? (recentBatch.finalOutput ?? recentBatch.plannedQuantity)
            : (recentBatch.finalOutput ?? recentBatch.plannedQuantity) / 1000;
        
        if (finalOutputKg > 0) {
          const productionCostPerKg = totalProductionCost / finalOutputKg;
          
          // Use the product's actual quantity and unit instead of parsing the name
          let weightPerPacketKg = 0;
          
          if (product.unit === "kg") {
            weightPerPacketKg = product.quantity;
          } else if (product.unit === "gm") {
            weightPerPacketKg = product.quantity / 1000;
          }
          
          productionCostPerPacket = productionCostPerKg * weightPerPacketKg;
        }
      }

      // Use product's actual quantity and unit for container info
      let containerSize = 0;
      let containerLabel = '';
      
      if (product.unit === "kg") {
        containerSize = product.quantity * 1000; // Convert kg to grams for consistency
        containerLabel = `${product.quantity}kg`;
      } else if (product.unit === "gm") {
        containerSize = product.quantity; // Use grams directly
        containerLabel = `${product.quantity}g`;
      }

      return {
        id: product.id,
        name: product.name,
        formulationId: product.formulationId,
        formulationName: product.formulation.name,
        batchId: null, // Not applicable for finished products
        batchNumber: null, // Not applicable for finished products
        createdAt: product.createdAt.toISOString(),
        availableQuantity,
        unit: "packets" as const,
        productionCostPerPacket,
        containerSize,
        containerLabel,
        formulation: {
          name: product.formulation.name,
          baseQuantity: product.formulation.baseQuantity,
          baseUnit: product.formulation.baseUnit,
          status: product.formulation.status
        },
        batches: [], // Can be populated if needed from formulation batches
      };
    })
    .filter((product) => product.availableQuantity > 0)
    .sort((a, b) => {
      // Sort alphabetically and numerically by product name
      const aParts = a.name.split(' ');
      const bParts = b.name.split(' ');
      
      // Get the formulation name (everything except the last part which is the quantity)
      const aFormulation = aParts.slice(0, -1).join(' ');
      const bFormulation = bParts.slice(0, -1).join(' ');
      
      // Get the quantity (last part)
      const aQuantity = aParts[aParts.length - 1];
      const bQuantity = bParts[bParts.length - 1];
      
      // First sort by formulation name alphabetically
      if (aFormulation.toLowerCase() < bFormulation.toLowerCase()) return -1;
      if (aFormulation.toLowerCase() > bFormulation.toLowerCase()) return 1;
      
      // If formulation names are the same, sort by quantity numerically
      const aNum = parseInt(aQuantity.replace(/\D/g, ''));
      const bNum = parseInt(bQuantity.replace(/\D/g, ''));
      
      return aNum - bNum;
    });

    return availableProducts;
  } catch (error) {
    console.error("Error fetching finished products:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)' },
        { status: 400 }
      );
    }

    // Fetch finished products directly from database
    const finishedProducts = await getFinishedProducts();

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Extract sales data using new logic
    const extractedSessions = extractSalesData(workbook);
    
    // Convert multi-session data to flat format for validation
    const flatData: any[] = [];
    let siNoCounter = 1;
    
    extractedSessions.forEach((session: any) => {
      session.sales.forEach((product: any) => {
        flatData.push({
          rowNumber: siNoCounter,
          siNo: siNoCounter,
          descriptionOfGoods: product.product,
          hsnSac: null,
          gstRate: null,
          mrpMarginal: null,
          case: null,
          quantity: product.pieces,
          rate: product.pricePerPiece,
          per: null,
          discPercent: 0,
          amount: product.totalPrice,
          // Additional session info
          sessionDate: session.date,
          customerName: session.name,
          voucherType: session.voucherType,
          voucherNo: session.voucherNo,
          sessionTotal: session.totalAmount
        });
        siNoCounter++;
      });
    });

    // Validate and process each record
    const data = flatData.map((rawRecord, index) => {
      // Validate and process the record with database products
      const validatedRecord = validateExcelRow(rawRecord, index + 1, finishedProducts);
      return validatedRecord;
    });

    return NextResponse.json({
      success: true,
      data: data,
      count: data.length
    });

  } catch (error) {
    console.error('Error parsing Excel file:', error);
    return NextResponse.json(
      { error: 'Failed to parse Excel file' },
      { status: 500 }
    );
  }
}
