-- Columns already exist in DB, added manually. This just records them in migration history.
ALTER TABLE "PackagingSession" ADD COLUMN IF NOT EXISTS "semiPackaged" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PackagingSession" ALTER COLUMN "packagingLoss" SET DEFAULT 0;
ALTER TABLE "ProductLabel" ADD COLUMN IF NOT EXISTS "semiPackageable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProductionBatch" ADD COLUMN IF NOT EXISTS "semiPackaged" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "SessionLabel" ADD COLUMN IF NOT EXISTS "semiPackaged" BOOLEAN NOT NULL DEFAULT false;