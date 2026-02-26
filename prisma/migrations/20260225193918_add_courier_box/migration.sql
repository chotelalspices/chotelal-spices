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

-- AddForeignKey
ALTER TABLE "CourierBox" ADD CONSTRAINT "CourierBox_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PackagingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
