-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('kg', 'gm');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "StockAction" AS ENUM ('add', 'reduce');

-- CreateEnum
CREATE TYPE "StockReason" AS ENUM ('purchase', 'wastage', 'damage', 'correction', 'production');

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('draft', 'confirmed', 'ready_for_packaging');

-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('sufficient', 'insufficient');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'production', 'packaging', 'sales', 'research', 'inventory', 'labels', 'box_inventory');

-- CreateEnum
CREATE TYPE "ResearchStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "LabelStockAction" AS ENUM ('add', 'reduce');

-- CreateEnum
CREATE TYPE "LabelStockReason" AS ENUM ('purchase', 'wastage', 'damage', 'correction');

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "status" "Status" NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hashedPassword" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMaterial" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "costPerUnit" DOUBLE PRECISION NOT NULL,
    "minimumStock" DOUBLE PRECISION NOT NULL,
    "status" "Status" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "action" "StockAction" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" "StockReason" NOT NULL,
    "reference" TEXT,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousCostPerUnit" DOUBLE PRECISION,
    "newCostPerUnit" DOUBLE PRECISION,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Formulation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseQuantity" DOUBLE PRECISION NOT NULL,
    "baseUnit" "Unit" NOT NULL,
    "status" "Status" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "defaultQuantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Formulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormulationIngredient" (
    "id" TEXT NOT NULL,
    "formulationId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "FormulationIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "formulationId" TEXT NOT NULL,
    "plannedQuantity" DOUBLE PRECISION NOT NULL,
    "availableQuantity" DOUBLE PRECISION,
    "unit" "Unit" NOT NULL,
    "finalOutput" DOUBLE PRECISION,
    "productionDate" TIMESTAMP(3) NOT NULL,
    "status" "ProductionStatus" NOT NULL,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "semiPackaged" DOUBLE PRECISION DEFAULT 0,

    CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialUsage" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "quantityUsed" DOUBLE PRECISION NOT NULL,
    "ratePerUnit" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MaterialUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedProduction" (
    "id" TEXT NOT NULL,
    "formulationId" TEXT NOT NULL,
    "plannedQuantity" DOUBLE PRECISION NOT NULL,
    "unit" "Unit" NOT NULL,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "materialStatus" "MaterialStatus" NOT NULL,
    "emailSent" BOOLEAN NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannedProduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnedProduct" (
    "id" TEXT NOT NULL,
    "formulationId" TEXT NOT NULL,
    "returnedQuantity" DOUBLE PRECISION NOT NULL,
    "unit" "Unit" NOT NULL,
    "returnReason" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL,
    "addedToStock" BOOLEAN NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContainerSize" (
    "id" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "ContainerSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagingSession" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "packagingLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "performedById" TEXT,
    "semiPackaged" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PackagingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierBox" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "itemsPerBox" INTEGER NOT NULL,
    "boxesNeeded" INTEGER NOT NULL,
    "totalPackets" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionLabel" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "semiPackaged" BOOLEAN NOT NULL DEFAULT false,
    "boxTypeId" TEXT,
    "boxesUsed" INTEGER DEFAULT 0,

    CONSTRAINT "SessionLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagedItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "numberOfPackets" INTEGER NOT NULL,
    "totalWeight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PackagedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinishedProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" "Unit" NOT NULL,
    "availableInventory" DOUBLE PRECISION,
    "formulationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinishedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Label" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "minimumStock" INTEGER NOT NULL DEFAULT 0,
    "status" "Status" NOT NULL DEFAULT 'active',
    "costPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabelMovement" (
    "id" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "action" "LabelStockAction" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "LabelStockReason" NOT NULL,
    "remarks" TEXT,
    "adjustmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousCostPerUnit" DOUBLE PRECISION,
    "newCostPerUnit" DOUBLE PRECISION,

    CONSTRAINT "LabelMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductLabel" (
    "productId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "semiPackageable" BOOLEAN NOT NULL DEFAULT false,
    "boxTypeId" TEXT,

    CONSTRAINT "ProductLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRecord" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "clientName" TEXT,
    "voucherNo" TEXT,
    "voucherType" TEXT,
    "quantitySold" INTEGER NOT NULL,
    "productionCost" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL,
    "sellingPrice" DOUBLE PRECISION NOT NULL,
    "profit" DOUBLE PRECISION NOT NULL,
    "remarks" TEXT,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unit" TEXT NOT NULL,
    "amountDue" DOUBLE PRECISION,
    "amountPaid" DOUBLE PRECISION,
    "paymentNote" TEXT,
    "paymentStatus" TEXT,
    "paymentUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "SalesRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMeta" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "city" TEXT,
    "salesman" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchFormulation" (
    "id" TEXT NOT NULL,
    "tempName" TEXT NOT NULL,
    "researcher" TEXT NOT NULL,
    "researchDate" TIMESTAMP(3) NOT NULL,
    "baseQuantity" DOUBLE PRECISION NOT NULL,
    "baseUnit" "Unit" NOT NULL,
    "notes" TEXT NOT NULL,
    "status" "ResearchStatus" NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchFormulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchIngredient" (
    "id" TEXT NOT NULL,
    "researchId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ResearchIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtendedInventory" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "companyName" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "code" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtendedInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchExtendedItem" (
    "id" TEXT NOT NULL,
    "researchId" TEXT NOT NULL,
    "extendedInventoryId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ResearchExtendedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "currency" TEXT NOT NULL,
    "currencySymbol" TEXT NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefaultValues" (
    "id" TEXT NOT NULL,
    "baseFormulationQuantity" DOUBLE PRECISION NOT NULL,
    "minimumStockAlertQuantity" DOUBLE PRECISION NOT NULL,
    "packagingLossVisibility" BOOLEAN NOT NULL,

    CONSTRAINT "DefaultValues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetOTP" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetOTP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormulationAudit" (
    "id" TEXT NOT NULL,
    "formulationId" TEXT NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changes" JSONB NOT NULL,

    CONSTRAINT "FormulationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesAuditLog" (
    "id" TEXT NOT NULL,
    "salesRecordId" TEXT NOT NULL,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "changes" JSONB NOT NULL,

    CONSTRAINT "SalesAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoxType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "costPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availableStock" INTEGER NOT NULL DEFAULT 0,
    "minimumStock" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoxType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoxMovement" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "remarks" TEXT,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boxTypeId" TEXT,

    CONSTRAINT "BoxMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserRoleAssignment_userId_role_key" ON "UserRoleAssignment"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBatch_batchNumber_key" ON "ProductionBatch"("batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Label_name_key" ON "Label"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductLabel_productId_labelId_key" ON "ProductLabel"("productId", "labelId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMeta_clientName_key" ON "ClientMeta"("clientName");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetOTP_email_key" ON "PasswordResetOTP"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BoxType_name_key" ON "BoxType"("name");

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulationIngredient" ADD CONSTRAINT "FormulationIngredient_formulationId_fkey" FOREIGN KEY ("formulationId") REFERENCES "Formulation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulationIngredient" ADD CONSTRAINT "FormulationIngredient_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_formulationId_fkey" FOREIGN KEY ("formulationId") REFERENCES "Formulation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialUsage" ADD CONSTRAINT "MaterialUsage_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialUsage" ADD CONSTRAINT "MaterialUsage_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedProduction" ADD CONSTRAINT "PlannedProduction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedProduction" ADD CONSTRAINT "PlannedProduction_formulationId_fkey" FOREIGN KEY ("formulationId") REFERENCES "Formulation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnedProduct" ADD CONSTRAINT "ReturnedProduct_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnedProduct" ADD CONSTRAINT "ReturnedProduct_formulationId_fkey" FOREIGN KEY ("formulationId") REFERENCES "Formulation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingSession" ADD CONSTRAINT "PackagingSession_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingSession" ADD CONSTRAINT "PackagingSession_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierBox" ADD CONSTRAINT "CourierBox_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PackagingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionLabel" ADD CONSTRAINT "SessionLabel_boxTypeId_fkey" FOREIGN KEY ("boxTypeId") REFERENCES "BoxType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionLabel" ADD CONSTRAINT "SessionLabel_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PackagingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagedItem" ADD CONSTRAINT "PackagedItem_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ContainerSize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagedItem" ADD CONSTRAINT "PackagedItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PackagingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedProduct" ADD CONSTRAINT "FinishedProduct_formulationId_fkey" FOREIGN KEY ("formulationId") REFERENCES "Formulation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelMovement" ADD CONSTRAINT "LabelMovement_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelMovement" ADD CONSTRAINT "LabelMovement_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLabel" ADD CONSTRAINT "ProductLabel_boxTypeId_fkey" FOREIGN KEY ("boxTypeId") REFERENCES "BoxType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLabel" ADD CONSTRAINT "ProductLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductLabel" ADD CONSTRAINT "ProductLabel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FinishedProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "FinishedProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchFormulation" ADD CONSTRAINT "ResearchFormulation_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchIngredient" ADD CONSTRAINT "ResearchIngredient_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchIngredient" ADD CONSTRAINT "ResearchIngredient_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "ResearchFormulation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtendedInventory" ADD CONSTRAINT "ExtendedInventory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchExtendedItem" ADD CONSTRAINT "ResearchExtendedItem_extendedInventoryId_fkey" FOREIGN KEY ("extendedInventoryId") REFERENCES "ExtendedInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchExtendedItem" ADD CONSTRAINT "ResearchExtendedItem_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "ResearchFormulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulationAudit" ADD CONSTRAINT "FormulationAudit_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulationAudit" ADD CONSTRAINT "FormulationAudit_formulationId_fkey" FOREIGN KEY ("formulationId") REFERENCES "Formulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesAuditLog" ADD CONSTRAINT "SalesAuditLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxMovement" ADD CONSTRAINT "BoxMovement_boxTypeId_fkey" FOREIGN KEY ("boxTypeId") REFERENCES "BoxType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxMovement" ADD CONSTRAINT "BoxMovement_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

