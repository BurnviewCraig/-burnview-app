-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN "farmId" TEXT;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
