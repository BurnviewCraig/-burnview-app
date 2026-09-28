-- AlterTable
ALTER TABLE "DieselLogEntry" ADD COLUMN     "secondFilledAtFarm" TEXT,
ADD COLUMN     "secondLitresFilled" DOUBLE PRECISION,
ADD COLUMN     "secondReading" DOUBLE PRECISION;
