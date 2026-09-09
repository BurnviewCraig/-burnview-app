-- DropIndex
DROP INDEX "MilkSaleEntry_farmId_date_key";

-- CreateIndex
CREATE INDEX "MilkSaleEntry_farmId_date_idx" ON "MilkSaleEntry"("farmId", "date");
