-- DropForeignKey
ALTER TABLE "PackagingSession" DROP CONSTRAINT "PackagingSession_performedById_fkey";

-- DropForeignKey
ALTER TABLE "PlannedProduction" DROP CONSTRAINT "PlannedProduction_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ReturnedProduct" DROP CONSTRAINT "ReturnedProduct_createdById_fkey";

-- DropForeignKey
ALTER TABLE "SalesRecord" DROP CONSTRAINT "SalesRecord_createdById_fkey";

-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_performedById_fkey";

-- AlterTable
ALTER TABLE "PackagingSession" ALTER COLUMN "performedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PlannedProduction" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ReturnedProduct" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SalesRecord" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StockMovement" ALTER COLUMN "performedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedProduction" ADD CONSTRAINT "PlannedProduction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnedProduct" ADD CONSTRAINT "ReturnedProduct_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagingSession" ADD CONSTRAINT "PackagingSession_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRecord" ADD CONSTRAINT "SalesRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
