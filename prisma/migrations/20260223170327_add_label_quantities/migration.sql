-- Step 1: Drop the old primary key constraint
ALTER TABLE "ProductLabel" DROP CONSTRAINT "ProductLabel_pkey";

-- Step 2: Drop the foreign key (will be recreated with CASCADE)
ALTER TABLE "ProductLabel" DROP CONSTRAINT "ProductLabel_productId_fkey";

-- Step 3: Add id column as optional first
ALTER TABLE "ProductLabel" ADD "id" TEXT;

-- Step 4: Populate id for existing rows using PostgreSQL's gen_random_uuid()
UPDATE "ProductLabel" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;

-- Step 5: Make id required and set as primary key
ALTER TABLE "ProductLabel" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "ProductLabel" ADD CONSTRAINT "ProductLabel_pkey" PRIMARY KEY ("id");

-- Step 6: Add quantity column with default value of 1 for existing rows
ALTER TABLE "ProductLabel" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

-- Step 7: Remove the default (keeps future inserts clean)
ALTER TABLE "ProductLabel" ALTER COLUMN "quantity" DROP DEFAULT;

-- Step 8: Create unique constraint on productId + labelId
CREATE UNIQUE INDEX "ProductLabel_productId_labelId_key" ON "ProductLabel"("productId", "labelId");

-- Step 9: Re-add foreign key with CASCADE delete
ALTER TABLE "ProductLabel" ADD CONSTRAINT "ProductLabel_productId_fkey" 
  FOREIGN KEY ("productId") REFERENCES "FinishedProduct"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;