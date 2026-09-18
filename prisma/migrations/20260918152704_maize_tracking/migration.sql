-- CreateTable
CREATE TABLE "MaizeHarvest" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "areaHa" DOUBLE PRECISION,
    "tonnage" DOUBLE PRECISION NOT NULL,
    "harvestDate" DATE NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaizeHarvest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaizeSale" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "tonnage" DOUBLE PRECISION NOT NULL,
    "pricePerTon" DOUBLE PRECISION NOT NULL,
    "buyer" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaizeSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaizePlantingPlan" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "plannedAreaHa" DOUBLE PRECISION,
    "variety" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaizePlantingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaizeMarketingOption" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "deliveryPeriod" TEXT,
    "tonnage" DOUBLE PRECISION NOT NULL,
    "pricePerTon" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "counterparty" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaizeMarketingOption_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MaizeHarvest" ADD CONSTRAINT "MaizeHarvest_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaizeHarvest" ADD CONSTRAINT "MaizeHarvest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaizeSale" ADD CONSTRAINT "MaizeSale_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaizeSale" ADD CONSTRAINT "MaizeSale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaizePlantingPlan" ADD CONSTRAINT "MaizePlantingPlan_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaizePlantingPlan" ADD CONSTRAINT "MaizePlantingPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaizeMarketingOption" ADD CONSTRAINT "MaizeMarketingOption_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaizeMarketingOption" ADD CONSTRAINT "MaizeMarketingOption_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
