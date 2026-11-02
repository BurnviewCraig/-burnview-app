-- CreateTable
CREATE TABLE "MilkQualityEntry" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "tankNumber" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "butterfatPct" DOUBLE PRECISION,
    "proteinPct" DOUBLE PRECISION,
    "lactosePct" DOUBLE PRECISION,
    "bactoscanCountPerMl" INTEGER,
    "somaticCellCountPerMl" INTEGER,
    "munMgPer100ml" DOUBLE PRECISION,
    "alizarolPct" DOUBLE PRECISION,
    "sourceFile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilkQualityEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MilkQualityEntry_farmId_date_idx" ON "MilkQualityEntry"("farmId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MilkQualityEntry_tankNumber_date_key" ON "MilkQualityEntry"("tankNumber", "date");

-- AddForeignKey
ALTER TABLE "MilkQualityEntry" ADD CONSTRAINT "MilkQualityEntry_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
