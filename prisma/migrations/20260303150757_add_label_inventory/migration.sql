-- CreateEnum
CREATE TYPE "LabelStockAction" AS ENUM ('add', 'reduce');

-- CreateEnum
CREATE TYPE "LabelStockReason" AS ENUM ('purchase', 'wastage', 'damage', 'correction');

-- AlterTable
ALTER TABLE "Label" ADD COLUMN     "description" TEXT,
ADD COLUMN     "minimumStock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "Status" NOT NULL DEFAULT 'active';

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

    CONSTRAINT "LabelMovement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LabelMovement" ADD CONSTRAINT "LabelMovement_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabelMovement" ADD CONSTRAINT "LabelMovement_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
