-- CreateTable
CREATE TABLE "RainfallEntry" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mm" DOUBLE PRECISION NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RainfallEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RainfallEntry_farmId_date_key" ON "RainfallEntry"("farmId", "date");

-- AddForeignKey
ALTER TABLE "RainfallEntry" ADD CONSTRAINT "RainfallEntry_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RainfallEntry" ADD CONSTRAINT "RainfallEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
