-- CreateTable
CREATE TABLE "GroupFeedEntry" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dairyMealKg" DOUBLE PRECISION,
    "otherConcentrateName" TEXT,
    "otherConcentrateKg" DOUBLE PRECISION,
    "silageKg" DOUBLE PRECISION,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupFeedEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupFeedEntry_groupId_date_key" ON "GroupFeedEntry"("groupId", "date");

-- AddForeignKey
ALTER TABLE "GroupFeedEntry" ADD CONSTRAINT "GroupFeedEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CattleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupFeedEntry" ADD CONSTRAINT "GroupFeedEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
