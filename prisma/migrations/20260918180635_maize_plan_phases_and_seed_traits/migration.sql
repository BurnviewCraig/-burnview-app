/*
  Warnings:

  - You are about to drop the column `variety` on the `MaizePlantingPlan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MaizePlantingPlan" DROP COLUMN "variety",
ADD COLUMN     "ordered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phase" TEXT,
ADD COLUMN     "population" DOUBLE PRECISION,
ADD COLUMN     "varietyId" TEXT;

-- AlterTable
ALTER TABLE "SeedVariety" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "traitType" TEXT;

-- AddForeignKey
ALTER TABLE "MaizePlantingPlan" ADD CONSTRAINT "MaizePlantingPlan_varietyId_fkey" FOREIGN KEY ("varietyId") REFERENCES "SeedVariety"("id") ON DELETE SET NULL ON UPDATE CASCADE;
