-- CreateTable
CREATE TABLE "MilkProductionEntry" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "litres" DOUBLE PRECISION NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilkProductionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkSaleEntry" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "litres" DOUBLE PRECISION NOT NULL,
    "takenBy" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilkSaleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MilkProductionEntry_groupId_date_key" ON "MilkProductionEntry"("groupId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MilkSaleEntry_farmId_date_key" ON "MilkSaleEntry"("farmId", "date");

-- AddForeignKey
ALTER TABLE "MilkProductionEntry" ADD CONSTRAINT "MilkProductionEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CattleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkProductionEntry" ADD CONSTRAINT "MilkProductionEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkSaleEntry" ADD CONSTRAINT "MilkSaleEntry_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkSaleEntry" ADD CONSTRAINT "MilkSaleEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
