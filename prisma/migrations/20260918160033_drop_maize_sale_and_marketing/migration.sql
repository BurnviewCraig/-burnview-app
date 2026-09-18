/*
  Warnings:

  - You are about to drop the `MaizeMarketingOption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MaizeSale` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MaizeMarketingOption" DROP CONSTRAINT "MaizeMarketingOption_createdById_fkey";

-- DropForeignKey
ALTER TABLE "MaizeMarketingOption" DROP CONSTRAINT "MaizeMarketingOption_farmId_fkey";

-- DropForeignKey
ALTER TABLE "MaizeSale" DROP CONSTRAINT "MaizeSale_createdById_fkey";

-- DropForeignKey
ALTER TABLE "MaizeSale" DROP CONSTRAINT "MaizeSale_farmId_fkey";

-- DropTable
DROP TABLE "MaizeMarketingOption";

-- DropTable
DROP TABLE "MaizeSale";
