-- AlterTable
ALTER TABLE "StockEntry" ADD COLUMN "fieldActivityId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StockEntry_fieldActivityId_key" ON "StockEntry"("fieldActivityId");

-- AddForeignKey
ALTER TABLE "StockEntry" ADD CONSTRAINT "StockEntry_fieldActivityId_fkey" FOREIGN KEY ("fieldActivityId") REFERENCES "FieldActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
