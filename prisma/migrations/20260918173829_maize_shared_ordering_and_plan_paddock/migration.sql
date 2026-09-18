/*
  Warnings:

  - Added the required column `paddockId` to the `MaizePlantingPlan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MaizePlantingPlan" ADD COLUMN     "paddockId" TEXT NOT NULL,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Paddock" ADD COLUMN     "maizeSortOrder" INTEGER;

-- AddForeignKey
ALTER TABLE "MaizePlantingPlan" ADD CONSTRAINT "MaizePlantingPlan_paddockId_fkey" FOREIGN KEY ("paddockId") REFERENCES "Paddock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
