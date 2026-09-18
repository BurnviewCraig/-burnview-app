-- AlterTable
ALTER TABLE "FieldActivity" ADD COLUMN     "sprayPurpose" TEXT;

-- AlterTable
ALTER TABLE "MaizeFieldSeason" ADD COLUMN     "burndownDate" DATE,
ADD COLUMN     "preGerminationSprayDate" DATE;

-- AlterTable
ALTER TABLE "SeedVariety" ADD COLUMN     "costPerBag" DOUBLE PRECISION,
ADD COLUMN     "daysToMaturity" INTEGER,
ADD COLUMN     "seedsPerBag" INTEGER;
