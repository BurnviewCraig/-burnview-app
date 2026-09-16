-- AlterTable: dedup key for AFI-imported milk sale rows (nullable, so
-- manually-entered rows are unaffected — multiple NULLs are allowed under
-- a unique index in Postgres).
ALTER TABLE "MilkSaleEntry" ADD COLUMN "sourceRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MilkSaleEntry_sourceRef_key" ON "MilkSaleEntry"("sourceRef");
