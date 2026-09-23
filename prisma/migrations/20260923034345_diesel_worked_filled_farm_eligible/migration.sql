-- AlterTable
ALTER TABLE "DieselLogEntry" ADD COLUMN     "eligible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "filledAtFarm" TEXT,
ADD COLUMN     "workedFarm" TEXT;
