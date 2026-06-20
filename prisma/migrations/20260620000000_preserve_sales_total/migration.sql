-- Uploaded sales totals are authoritative and may not equal quantity * rate.
ALTER TABLE "SalesRecord" ADD COLUMN "totalAmount" DOUBLE PRECISION;