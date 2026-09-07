-- CreateEnum
CREATE TYPE "TimeBookSection" AS ENUM ('DAIRY', 'STAFF');

-- CreateEnum
CREATE TYPE "AttendanceCode" AS ENUM ('PRESENT', 'LEAVE', 'ABSENT', 'OFF');

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "section" "TimeBookSection" NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeBookEntry" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "code" "AttendanceCode",
    "overtime" TEXT,

    CONSTRAINT "TimeBookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Worker_farmId_section_idx" ON "Worker"("farmId", "section");

-- CreateIndex
CREATE UNIQUE INDEX "TimeBookEntry_workerId_date_key" ON "TimeBookEntry"("workerId", "date");

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBookEntry" ADD CONSTRAINT "TimeBookEntry_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
