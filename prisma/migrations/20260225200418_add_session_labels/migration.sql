-- CreateTable
CREATE TABLE "SessionLabel" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionLabel_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SessionLabel" ADD CONSTRAINT "SessionLabel_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PackagingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
