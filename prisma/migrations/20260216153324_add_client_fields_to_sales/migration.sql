/*
  Warnings:

  - You are about to alter the column `quantitySold` on the `SalesRecord` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - Changed the type of `unit` on the `SalesRecord` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `productionCost` on table `SalesRecord` required. This step will fail if there are existing NULL values in that column.
  - Made the column `discount` on table `SalesRecord` required. This step will fail if there are existing NULL values in that column.
  - Made the column `profit` on table `SalesRecord` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "SalesRecord" ALTER COLUMN "quantitySold" SET DATA TYPE INTEGER,
DROP COLUMN "unit",
ADD COLUMN     "unit" TEXT NOT NULL,
ALTER COLUMN "productionCost" SET NOT NULL,
ALTER COLUMN "discount" SET NOT NULL,
ALTER COLUMN "profit" SET NOT NULL;
