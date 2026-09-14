-- CreateEnum
CREATE TYPE "DieselUnit" AS ENUM ('HOURS', 'KM');

-- CreateTable
CREATE TABLE "DieselAsset" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "numberPlate" TEXT,
    "unit" "DieselUnit" NOT NULL DEFAULT 'HOURS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DieselAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DieselLogEntry" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "openingReading" DOUBLE PRECISION,
    "litresFilled" DOUBLE PRECISION,
    "driverId" TEXT,
    "activities" JSONB,
    "paddockCodes" JSONB,
    "comment" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DieselLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DieselAsset_farmId_name_key" ON "DieselAsset"("farmId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DieselLogEntry_assetId_date_key" ON "DieselLogEntry"("assetId", "date");

-- AddForeignKey
ALTER TABLE "DieselAsset" ADD CONSTRAINT "DieselAsset_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DieselLogEntry" ADD CONSTRAINT "DieselLogEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DieselAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DieselLogEntry" ADD CONSTRAINT "DieselLogEntry_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DieselLogEntry" ADD CONSTRAINT "DieselLogEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
