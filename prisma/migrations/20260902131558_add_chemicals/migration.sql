-- AlterTable
ALTER TABLE "FieldActivity" ADD COLUMN     "chemicals" JSONB;

-- CreateTable
CREATE TABLE "ChemicalType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'L/ha',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChemicalType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChemicalType_name_key" ON "ChemicalType"("name");
