export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to perform this action.' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: {
        userRoles: {
          select: { role: true }
        }
      }
    });

    if (!currentUser || !currentUser.userRoles.some(ur => ur.role === 'admin')) {
      return NextResponse.json(
        { error: 'Access denied. Admin privileges required.' },
        { status: 403 }
      );
    }

    // Get business settings
    const businessSettings = await prisma.businessSettings.findFirst({
      orderBy: { id: 'asc' }
    });

    // Get default values
    const defaultValues = await prisma.defaultValues.findFirst({
      orderBy: { id: 'asc' }
    });

    // If no settings exist, create default ones
    if (!businessSettings) {
      const newBusinessSettings = await prisma.businessSettings.create({
        data: {
          businessName: 'SpiceMaster Industries',
          currency: 'INR',
          currencySymbol: '₹',
        }
      });
      
      return NextResponse.json({
        businessSettings: {
          id: newBusinessSettings.id,
          businessName: newBusinessSettings.businessName,
          logoUrl: newBusinessSettings.logoUrl,
          currency: newBusinessSettings.currency,
          currencySymbol: newBusinessSettings.currencySymbol,
          measurementUnits: {
            production: 'kg',
            packaging: 'g',
          },
        },
        defaultValues: defaultValues ? {
          id: defaultValues.id,
          baseFormulationQuantity: defaultValues.baseFormulationQuantity,
          minimumStockAlertQuantity: defaultValues.minimumStockAlertQuantity,
          packagingLossVisibility: defaultValues.packagingLossVisibility,
        } : null,
        permissions: {
          showProfitToStaff: false,
          showCostOnDashboard: true,
          allowSalesEdit: false,
        },
        lastUpdated: newBusinessSettings.id ? new Date().toISOString().split('T')[0] : '2024-12-20',
        updatedBy: session.user.name || 'Unknown User',
      }, { status: 200 });
    }

    // If no default values exist, create default ones
    if (!defaultValues) {
      const newDefaultValues = await prisma.defaultValues.create({
        data: {
          baseFormulationQuantity: 100,
          minimumStockAlertQuantity: 25,
          packagingLossVisibility: true,
        }
      });

      return NextResponse.json({
        businessSettings: {
          id: businessSettings.id,
          businessName: businessSettings.businessName,
          logoUrl: businessSettings.logoUrl,
          currency: businessSettings.currency,
          currencySymbol: businessSettings.currencySymbol,
          measurementUnits: {
            production: 'kg',
            packaging: 'g',
          },
        },
        defaultValues: {
          id: newDefaultValues.id,
          baseFormulationQuantity: newDefaultValues.baseFormulationQuantity,
          minimumStockAlertQuantity: newDefaultValues.minimumStockAlertQuantity,
          packagingLossVisibility: newDefaultValues.packagingLossVisibility,
        },
        permissions: {
          showProfitToStaff: false,
          showCostOnDashboard: true,
          allowSalesEdit: false,
        },
        lastUpdated: businessSettings.id ? new Date().toISOString().split('T')[0] : '2024-12-20',
        updatedBy: session.user.name || 'Unknown User',
      }, { status: 200 });
    }

    return NextResponse.json({
      businessSettings: {
        id: businessSettings.id,
        businessName: businessSettings.businessName,
        logoUrl: businessSettings.logoUrl,
        currency: businessSettings.currency,
        currencySymbol: businessSettings.currencySymbol,
        measurementUnits: {
          production: 'kg',
          packaging: 'g',
        },
      },
      defaultValues: {
        id: defaultValues.id,
        baseFormulationQuantity: defaultValues.baseFormulationQuantity,
        minimumStockAlertQuantity: defaultValues.minimumStockAlertQuantity,
        packagingLossVisibility: defaultValues.packagingLossVisibility,
      },
      permissions: {
        showProfitToStaff: false,
        showCostOnDashboard: true,
        allowSalesEdit: false,
      },
      lastUpdated: businessSettings.id ? new Date().toISOString().split('T')[0] : '2024-12-20',
      updatedBy: session.user.name || 'Unknown User',
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to perform this action.' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: {
        userRoles: {
          select: { role: true }
        }
      }
    });

    if (!currentUser || !currentUser.userRoles.some(ur => ur.role === 'admin')) {
      return NextResponse.json(
        { error: 'Access denied. Admin privileges required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { businessSettings, defaultValues } = body;

    // Validate required fields
    if (!businessSettings || !businessSettings.businessName) {
      return NextResponse.json(
        { error: 'Business name is required' },
        { status: 400 }
      );
    }

    if (!defaultValues || 
        typeof defaultValues.baseFormulationQuantity !== 'number' ||
        typeof defaultValues.minimumStockAlertQuantity !== 'number') {
      return NextResponse.json(
        { error: 'Valid default values are required' },
        { status: 400 }
      );
    }

    // Get existing settings
    const existingBusinessSettings = await prisma.businessSettings.findFirst({
      orderBy: { id: 'asc' }
    });

    const existingDefaultValues = await prisma.defaultValues.findFirst({
      orderBy: { id: 'asc' }
    });

    // Update or create business settings
    let updatedBusinessSettings;
    if (existingBusinessSettings) {
      updatedBusinessSettings = await prisma.businessSettings.update({
        where: { id: existingBusinessSettings.id },
        data: {
          businessName: businessSettings.businessName.trim(),
          logoUrl: businessSettings.logoUrl || null,
          currency: businessSettings.currency || 'INR',
          currencySymbol: businessSettings.currencySymbol || '₹',
        }
      });
    } else {
      updatedBusinessSettings = await prisma.businessSettings.create({
        data: {
          businessName: businessSettings.businessName.trim(),
          logoUrl: businessSettings.logoUrl || null,
          currency: businessSettings.currency || 'INR',
          currencySymbol: businessSettings.currencySymbol || '₹',
        }
      });
    }

    // Update or create default values
    let updatedDefaultValues;
    if (existingDefaultValues) {
      updatedDefaultValues = await prisma.defaultValues.update({
        where: { id: existingDefaultValues.id },
        data: {
          baseFormulationQuantity: defaultValues.baseFormulationQuantity,
          minimumStockAlertQuantity: defaultValues.minimumStockAlertQuantity,
          packagingLossVisibility: defaultValues.packagingLossVisibility !== undefined 
            ? defaultValues.packagingLossVisibility 
            : true,
        }
      });
    } else {
      updatedDefaultValues = await prisma.defaultValues.create({
        data: {
          baseFormulationQuantity: defaultValues.baseFormulationQuantity,
          minimumStockAlertQuantity: defaultValues.minimumStockAlertQuantity,
          packagingLossVisibility: defaultValues.packagingLossVisibility !== undefined 
            ? defaultValues.packagingLossVisibility 
            : true,
        }
      });
    }

    return NextResponse.json({
      businessSettings: {
        id: updatedBusinessSettings.id,
        businessName: updatedBusinessSettings.businessName,
        logoUrl: updatedBusinessSettings.logoUrl,
        currency: updatedBusinessSettings.currency,
        currencySymbol: updatedBusinessSettings.currencySymbol,
        measurementUnits: {
          production: 'kg',
          packaging: 'g',
        },
      },
      defaultValues: {
        id: updatedDefaultValues.id,
        baseFormulationQuantity: updatedDefaultValues.baseFormulationQuantity,
        minimumStockAlertQuantity: updatedDefaultValues.minimumStockAlertQuantity,
        packagingLossVisibility: updatedDefaultValues.packagingLossVisibility,
      },
      permissions: {
        showProfitToStaff: false,
        showCostOnDashboard: true,
        allowSalesEdit: false,
      },
      lastUpdated: new Date().toISOString().split('T')[0],
      updatedBy: session.user.name || 'Unknown User',
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
