-- CreateTable
CREATE TABLE "WaterMeter" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WaterMeter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterMeterReading" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reading" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaterMeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WaterMeterReading_meterId_date_key" ON "WaterMeterReading"("meterId", "date");

-- AddForeignKey
ALTER TABLE "WaterMeter" ADD CONSTRAINT "WaterMeter_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterMeterReading" ADD CONSTRAINT "WaterMeterReading_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "WaterMeter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterMeterReading" ADD CONSTRAINT "WaterMeterReading_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
