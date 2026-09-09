-- AlterTable: milk production is entered as litres per cow, not the
-- group's tank total.
ALTER TABLE "MilkProductionEntry" RENAME COLUMN "litres" TO "litresPerCow";
