-- CreateTable
CREATE TABLE "GroupDimEntry" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "avgDaysInMilk" DOUBLE PRECISION NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupDimEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupDimEntry_groupId_date_key" ON "GroupDimEntry"("groupId", "date");

-- AddForeignKey
ALTER TABLE "GroupDimEntry" ADD CONSTRAINT "GroupDimEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CattleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupDimEntry" ADD CONSTRAINT "GroupDimEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
