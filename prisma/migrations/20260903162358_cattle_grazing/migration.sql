-- CreateEnum
CREATE TYPE "GrazingSession" AS ENUM ('DAY', 'NIGHT');

-- CreateTable
CREATE TABLE "CattleGroup" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CattleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrazingAllocation" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "paddockId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "session" "GrazingSession" NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrazingAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CattleCountEntry" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CattleCountEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CattleGroup_farmId_name_key" ON "CattleGroup"("farmId", "name");

-- CreateIndex
CREATE INDEX "GrazingAllocation_farmId_date_idx" ON "GrazingAllocation"("farmId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GrazingAllocation_groupId_date_session_key" ON "GrazingAllocation"("groupId", "date", "session");

-- CreateIndex
CREATE UNIQUE INDEX "CattleCountEntry_groupId_date_key" ON "CattleCountEntry"("groupId", "date");

-- AddForeignKey
ALTER TABLE "CattleGroup" ADD CONSTRAINT "CattleGroup_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrazingAllocation" ADD CONSTRAINT "GrazingAllocation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CattleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrazingAllocation" ADD CONSTRAINT "GrazingAllocation_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrazingAllocation" ADD CONSTRAINT "GrazingAllocation_paddockId_fkey" FOREIGN KEY ("paddockId") REFERENCES "Paddock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrazingAllocation" ADD CONSTRAINT "GrazingAllocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CattleCountEntry" ADD CONSTRAINT "CattleCountEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CattleGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CattleCountEntry" ADD CONSTRAINT "CattleCountEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
