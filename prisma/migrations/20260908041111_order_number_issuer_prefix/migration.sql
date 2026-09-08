-- AlterTable: add per-issuer prefix; number is now computed per-prefix in
-- application code rather than a single shared DB sequence.
ALTER TABLE "OrderNumber" ADD COLUMN "prefix" TEXT NOT NULL DEFAULT 'CS';
ALTER TABLE "OrderNumber" ALTER COLUMN "number" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "OrderNumber_prefix_number_key" ON "OrderNumber"("prefix", "number");
