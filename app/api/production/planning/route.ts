export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    const plannedProductions = await prisma.plannedProduction.findMany({
      include: {
        formulation: true,
        createdBy: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: {
        plannedDate: "asc",
      },
    });

    const formattedPlans = plannedProductions.map((plan) => ({
      id: plan.id,
      formulationId: plan.formulationId,
      formulationName: plan.formulation.name,
      plannedQuantity: plan.plannedQuantity,
      unit: plan.unit.toLowerCase() as "kg" | "gm",
      plannedDate: plan.plannedDate.toISOString(),
      materialStatus: plan.materialStatus.toLowerCase() as
        | "sufficient"
        | "insufficient",
      emailSent: plan.emailSent,
      createdBy: plan.createdBy.fullName,
      createdAt: plan.createdAt.toISOString(),
    }));

    return NextResponse.json(formattedPlans, { status: 200 });
  } catch (error) {
    console.error("Error fetching planned productions:", error);
    return NextResponse.json(
      { error: "Failed to fetch planned productions" },
      { status: 500 }
    );
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

    const body = await request.json();
    const { formulationId, plannedQuantity, numberOfLots, finalQuantity, unit, plannedDate, materialStatus } =
      body;

    // Validate required fields
    if (!formulationId || !plannedQuantity || !finalQuantity || !unit || !plannedDate) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: formulationId, plannedQuantity, finalQuantity, unit, and plannedDate are required",
        },
        { status: 400 }
      );
    }

    // Validate unit enum
    if (!["kg", "gm"].includes(unit.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid unit. Must be "kg" or "gm"' },
        { status: 400 }
      );
    }

    // Validate materialStatus enum
    if (materialStatus && !["sufficient", "insufficient"].includes(materialStatus.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid materialStatus. Must be "sufficient" or "insufficient"' },
        { status: 400 }
      );
    }

    // Verify formulation exists
    const formulation = await prisma.formulation.findUnique({
      where: { id: formulationId },
    });

    if (!formulation) {
      return NextResponse.json(
        { error: "Formulation not found" },
        { status: 404 }
      );
    }

    // Determine material status if not provided
    let finalMaterialStatus: "sufficient" | "insufficient" = materialStatus?.toLowerCase() as "sufficient" | "insufficient" || "sufficient";

    // Check material availability
    if (!materialStatus) {
      // Normalize final quantity to formulation base unit for scale factor calculation
      let plannedQtyInBaseUnit = parseFloat(finalQuantity.toString());
      if (unit.toLowerCase() !== formulation.baseUnit.toLowerCase()) {
        if (unit.toLowerCase() === "kg" && formulation.baseUnit.toLowerCase() === "gm") {
          plannedQtyInBaseUnit = parseFloat(plannedQuantity) * 1000;
        } else if (unit.toLowerCase() === "gm" && formulation.baseUnit.toLowerCase() === "kg") {
          plannedQtyInBaseUnit = parseFloat(plannedQuantity) / 1000;
        }
      }
      
      const scaleFactor = plannedQtyInBaseUnit / formulation.baseQuantity;
      
      const formulationWithIngredients = await prisma.formulation.findUnique({
        where: { id: formulationId },
        include: {
          ingredients: {
            include: {
              rawMaterial: {
                include: {
                  stockMovements: true,
                },
              },
            },
          },
        },
      });

      if (formulationWithIngredients) {
        for (const ingredient of formulationWithIngredients.ingredients) {
          const rawMaterial = ingredient.rawMaterial;

          // Calculate available stock
          const availableStock = rawMaterial.stockMovements.reduce(
            (total, movement) => {
              if (movement.action === "add") {
                return total + movement.quantity;
              } else {
                return total - movement.quantity;
              }
            },
            0
          );

          // Calculate required quantity
          const baseRequiredQty =
            (ingredient.percentage / 100) * formulation.baseQuantity;
          const requiredQuantity = baseRequiredQty * scaleFactor;

          // Convert units if necessary
          let availableInSameUnit = availableStock;
          if (formulation.baseUnit !== rawMaterial.unit) {
            if (formulation.baseUnit === "kg" && rawMaterial.unit === "gm") {
              availableInSameUnit = availableStock / 1000;
            } else {
              availableInSameUnit = availableStock * 1000;
            }
          }

          if (availableInSameUnit < requiredQuantity) {
            finalMaterialStatus = "insufficient";
            break;
          }
        }
      }
    }

    // Create planned production
    const plannedProduction = await prisma.plannedProduction.create({
      data: {
        formulationId,
        plannedQuantity: parseFloat(finalQuantity.toString()), // Store final quantity in plannedQuantity field
        unit: unit.toLowerCase() as "kg" | "gm",
        plannedDate: new Date(plannedDate),
        materialStatus: finalMaterialStatus,
        emailSent: false, // Will be updated after email attempt
        createdById: authenticatedUserId,
      },
      include: {
        formulation: true,
        createdBy: {
          select: {
            fullName: true,
          },
        },
      },
    });

    // Send email notification to all admin and packaging users
    let emailSentSuccessfully = false;
    try {
      // Get all users with admin or packaging roles
      const notificationUsers = await prisma.user.findMany({
        where: {
          status: "active",
          userRoles: {
            some: {
              role: {
                in: ["admin", "packaging"]
              }
            }
          }
        },
        select: {
          email: true,
          fullName: true
        }
      });

      if (notificationUsers.length > 0) {
        // Get material requirements for the email
        const materialsResponse = await fetch(
          `${request.nextUrl.origin}/api/production/materials?formulationId=${formulationId}&plannedQuantity=${finalQuantity}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        let materialsList = [];
        let insufficientMaterials = [];
        if (materialsResponse.ok) {
          const materials = await materialsResponse.json();
          materialsList = materials.map((req: any) => 
            `${req.rawMaterialName}: ${req.requiredQuantity.toFixed(2)} ${req.unit} (available: ${req.availableStock.toFixed(2)} ${req.unit}) - ${req.stockStatus}`
          );
          insufficientMaterials = materials
            .filter((req: any) => req.stockStatus === "insufficient")
            .map((req: any) => `${req.rawMaterialName}: ${req.requiredQuantity.toFixed(2)} ${req.unit} (available: ${req.availableStock.toFixed(2)} ${req.unit})`);
        }

        // Prepare email content
        const emailSubject = `New Production Plan Created - ${formulation.name}`;
        const emailHtmlContent = `
          <html>
            <body>
              <h2>� New Production Plan Created</h2>
              <p><strong>Product:</strong> ${formulation.name}</p>
              <p><strong>Planned Quantity:</strong> ${finalQuantity} ${unit}</p>
              <p><strong>Planned Date:</strong> ${new Date(plannedDate).toLocaleDateString()}</p>
              <p><strong>Created By:</strong> ${plannedProduction.createdBy.fullName}</p>
              <p><strong>Material Status:</strong> ${finalMaterialStatus === "sufficient" ? "✅ Sufficient" : "⚠️ Insufficient"}</p>
              
              <h3>📦 Material Requirements:</h3>
              <ul>
                ${materialsList.length > 0 ? materialsList.map((material: string) => `<li>${material}</li>`).join('') : '<li>No material details available</li>'}
              </ul>
              
              ${insufficientMaterials.length > 0 ? `
                <h3>🚨 Action Required - Insufficient Materials:</h3>
                <ul>
                  ${insufficientMaterials.map((material: string) => `<li><strong>${material}</strong></li>`).join('')}
                </ul>
                <p><strong>Please restock the above materials before the planned production date.</strong></p>
              ` : '<p>✅ All materials are available for production.</p>'}
              
              <hr>
              <p><em>This is an automated notification from the Production Planning System.</em></p>
            </body>
          </html>
        `;

        // Send email to all admin and packaging users
        const emailResponse = await fetch(`${request.nextUrl.origin}/api/sendmail`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: notificationUsers.map(user => user.email),
            subject: emailSubject,
            htmlContent: emailHtmlContent
          })
        });

        if (emailResponse.ok) {
          emailSentSuccessfully = true;
          console.log(`Email sent successfully to ${notificationUsers.length} users`);
        } else {
          console.error('Failed to send email:', await emailResponse.text());
        }
      } else {
        console.log('No admin or packaging users found to notify');
        emailSentSuccessfully = true; // Mark as successful since no users to notify
      }
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
    }

    // Update email status
    await prisma.plannedProduction.update({
      where: { id: plannedProduction.id },
      data: { emailSent: emailSentSuccessfully }
    });

    return NextResponse.json(
      {
        id: plannedProduction.id,
        formulationId: plannedProduction.formulationId,
        formulationName: plannedProduction.formulation.name,
        plannedQuantity: parseFloat(plannedQuantity.toString()), // Return original planned quantity
        numberOfLots: numberOfLots || 1,
        finalQuantity: parseFloat(finalQuantity.toString()), // Return final quantity
        unit: plannedProduction.unit.toLowerCase() as "kg" | "gm",
        plannedDate: plannedProduction.plannedDate.toISOString(),
        materialStatus: plannedProduction.materialStatus.toLowerCase() as
          | "sufficient"
          | "insufficient",
        emailSent: plannedProduction.emailSent,
        createdBy: plannedProduction.createdBy.fullName,
        createdAt: plannedProduction.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating planned production:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to create planned production" },
      { status: 500 }
    );
  }
}
