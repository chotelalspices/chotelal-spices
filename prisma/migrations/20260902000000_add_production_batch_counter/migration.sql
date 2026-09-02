-- CreateTable
-- Stores the last allocated batch sequence number per year. Allocating a
-- new number is a single atomic "INSERT ... ON CONFLICT DO UPDATE ...
-- RETURNING" statement (see lib/production-batch.ts), which Postgres
-- serializes per-row across concurrent transactions. This replaces the
-- previous "read latest batch, parse number, +1" approach, which could
-- both race under concurrent requests and (because it ordered
-- batchNumber lexicographically) misread "999" as greater than "1000"
-- once a year's sequence crossed into 4 digits, causing the same
-- batch number to be regenerated indefinitely.
CREATE TABLE "ProductionBatchCounter" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductionBatchCounter_pkey" PRIMARY KEY ("year")
);

-- Seed the counter from existing ProductionBatch rows using the true
-- numeric maximum per year (cast to INTEGER, not compared as text), so
-- numbering continues correctly even for years that already have
-- batch numbers past 999. No existing rows are modified or deleted.
INSERT INTO "ProductionBatchCounter" ("year", "lastNumber")
SELECT
    split_part("batchNumber", '-', 2)::INTEGER AS "year",
    MAX(split_part("batchNumber", '-', 3)::INTEGER) AS "lastNumber"
FROM "ProductionBatch"
WHERE "batchNumber" ~ '^BATCH-[0-9]{4}-[0-9]+$'
GROUP BY split_part("batchNumber", '-', 2)::INTEGER
ON CONFLICT ("year") DO UPDATE SET "lastNumber" = EXCLUDED."lastNumber";
