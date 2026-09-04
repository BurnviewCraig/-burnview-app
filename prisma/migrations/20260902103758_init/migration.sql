-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('FERTILIZER', 'MULCHING', 'PLANTING', 'LAND_PREP', 'SPRAYING');

-- CreateEnum
CREATE TYPE "StockKind" AS ENUM ('FEED', 'LAND_INPUT');

-- CreateEnum
CREATE TYPE "StockMode" AS ENUM ('USE', 'RESTOCK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paddock" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sizeHa" DOUBLE PRECISION,
    "landType" TEXT,

    CONSTRAINT "Paddock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldActivity" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "paddockId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "product" TEXT,
    "rate" DOUBLE PRECISION,
    "method" TEXT,
    "depth" DOUBLE PRECISION,
    "mix" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastureWalk" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "paddockId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cover" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PastureWalk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FertilizerType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nitrogenPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "phosphorusPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "potassiumPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sulfurPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FertilizerType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "kind" "StockKind" NOT NULL,
    "category" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockEntry" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "mode" "StockMode" NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "farmId" TEXT,
    "paddockId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Farm_slug_key" ON "Farm"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Paddock_farmId_code_key" ON "Paddock"("farmId", "code");

-- CreateIndex
CREATE INDEX "FieldActivity_farmId_paddockId_idx" ON "FieldActivity"("farmId", "paddockId");

-- CreateIndex
CREATE INDEX "PastureWalk_farmId_paddockId_date_idx" ON "PastureWalk"("farmId", "paddockId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FertilizerType_name_key" ON "FertilizerType"("name");

-- CreateIndex
CREATE INDEX "StockEntry_itemId_idx" ON "StockEntry"("itemId");

-- AddForeignKey
ALTER TABLE "Paddock" ADD CONSTRAINT "Paddock_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldActivity" ADD CONSTRAINT "FieldActivity_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldActivity" ADD CONSTRAINT "FieldActivity_paddockId_fkey" FOREIGN KEY ("paddockId") REFERENCES "Paddock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldActivity" ADD CONSTRAINT "FieldActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastureWalk" ADD CONSTRAINT "PastureWalk_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastureWalk" ADD CONSTRAINT "PastureWalk_paddockId_fkey" FOREIGN KEY ("paddockId") REFERENCES "Paddock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastureWalk" ADD CONSTRAINT "PastureWalk_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_paddockId_fkey" FOREIGN KEY ("paddockId") REFERENCES "Paddock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
