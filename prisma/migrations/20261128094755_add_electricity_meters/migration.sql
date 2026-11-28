-- CreateTable
CREATE TABLE "ElectricityMeter" (
    "id" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "farmId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectricityMeter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectricityBill" (
    "id" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "accountMonth" TEXT NOT NULL,
    "billingDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "tariffName" TEXT,
    "kwhTotal" DOUBLE PRECISION,
    "kwhPeak" DOUBLE PRECISION,
    "kwhStandard" DOUBLE PRECISION,
    "kwhOffPeak" DOUBLE PRECISION,
    "demandKva" DOUBLE PRECISION,
    "chargesExclVat" DOUBLE PRECISION,
    "vat" DOUBLE PRECISION,
    "totalAmountDue" DOUBLE PRECISION,
    "sourceFile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectricityBill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ElectricityMeter_accountNo_key" ON "ElectricityMeter"("accountNo");

-- CreateIndex
CREATE UNIQUE INDEX "ElectricityBill_invoiceNo_key" ON "ElectricityBill"("invoiceNo");

-- CreateIndex
CREATE INDEX "ElectricityBill_meterId_idx" ON "ElectricityBill"("meterId");

-- AddForeignKey
ALTER TABLE "ElectricityMeter" ADD CONSTRAINT "ElectricityMeter_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectricityBill" ADD CONSTRAINT "ElectricityBill_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "ElectricityMeter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
