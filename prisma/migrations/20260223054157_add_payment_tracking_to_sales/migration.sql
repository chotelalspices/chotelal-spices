-- AlterTable
ALTER TABLE "SalesRecord" ADD COLUMN     "amountDue" DOUBLE PRECISION,
ADD COLUMN     "amountPaid" DOUBLE PRECISION,
ADD COLUMN     "paymentNote" TEXT,
ADD COLUMN     "paymentStatus" TEXT,
ADD COLUMN     "paymentUpdatedAt" TIMESTAMP(3);
