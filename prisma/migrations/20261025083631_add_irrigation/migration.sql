-- CreateTable
CREATE TABLE "Pivot" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "paddockCodes" TEXT[],
    "mmAt100Pct" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Pivot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrrigationRun" (
    "id" TEXT NOT NULL,
    "pivotId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "percentage" INTEGER NOT NULL,
    "startPaddockId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IrrigationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IrrigationRun_date_idx" ON "IrrigationRun"("date");

-- AddForeignKey
ALTER TABLE "Pivot" ADD CONSTRAINT "Pivot_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationRun" ADD CONSTRAINT "IrrigationRun_pivotId_fkey" FOREIGN KEY ("pivotId") REFERENCES "Pivot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationRun" ADD CONSTRAINT "IrrigationRun_startPaddockId_fkey" FOREIGN KEY ("startPaddockId") REFERENCES "Paddock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationRun" ADD CONSTRAINT "IrrigationRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
