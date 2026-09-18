/*
  Warnings:

  - You are about to drop the `MaizeHarvest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MaizeHarvest" DROP CONSTRAINT "MaizeHarvest_createdById_fkey";

-- DropForeignKey
ALTER TABLE "MaizeHarvest" DROP CONSTRAINT "MaizeHarvest_farmId_fkey";

-- DropTable
DROP TABLE "MaizeHarvest";

-- CreateTable
CREATE TABLE "MaizeFieldSeason" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "paddockId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "variety" TEXT,
    "varietyLength" TEXT,
    "plantDate" DATE,
    "estMaturityDate" DATE,
    "cutDate" DATE,
    "population" DOUBLE PRECISION,
    "yieldTonPerHa" DOUBLE PRECISION,
    "firstPostSprayDate" DATE,
    "lastTractorEntryDate" DATE,
    "firstTopDressingDate" DATE,
    "secondTopDressingDate" DATE,
    "silagePit" TEXT,
    "seedCostPerHa" DOUBLE PRECISION,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaizeFieldSeason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaizeFieldSeason_paddockId_season_key" ON "MaizeFieldSeason"("paddockId", "season");

-- AddForeignKey
ALTER TABLE "MaizeFieldSeason" ADD CONSTRAINT "MaizeFieldSeason_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaizeFieldSeason" ADD CONSTRAINT "MaizeFieldSeason_paddockId_fkey" FOREIGN KEY ("paddockId") REFERENCES "Paddock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaizeFieldSeason" ADD CONSTRAINT "MaizeFieldSeason_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
