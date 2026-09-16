-- CreateTable
CREATE TABLE "GroupWeightEntry" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "avgWeightKg" DOUBLE PRECISION NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupWeightEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupWeightEntry_groupId_date_key" ON "GroupWeightEntry"("groupId", "date");

-- AddForeignKey
ALTER TABLE "GroupWeightEntry" ADD CONSTRAINT "GroupWeightEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CattleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupWeightEntry" ADD CONSTRAINT "GroupWeightEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
