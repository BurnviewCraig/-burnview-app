-- CreateEnum
CREATE TYPE "TelemetryDeviceKind" AS ENUM ('TANK_SENSOR', 'PUMP_CONTROLLER', 'PIVOT_CONTROLLER');

-- CreateEnum
CREATE TYPE "PumpCommandAction" AS ENUM ('START', 'STOP');

-- CreateEnum
CREATE TYPE "PumpCommandSource" AS ENUM ('MANUAL', 'TRIGGER', 'SCHEDULE');

-- CreateEnum
CREATE TYPE "PumpCommandStatus" AS ENUM ('PENDING', 'SENT', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "TriggerComparison" AS ENUM ('BELOW', 'ABOVE');

-- CreateEnum
CREATE TYPE "RuraflexSeason" AS ENUM ('HIGH_DEMAND', 'LOW_DEMAND');

-- CreateEnum
CREATE TYPE "RuraflexDayType" AS ENUM ('WEEKDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "RuraflexPeriod" AS ENUM ('PEAK', 'STANDARD', 'OFF_PEAK');

-- CreateTable
CREATE TABLE "TelemetryDevice" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TelemetryDeviceKind" NOT NULL,
    "topicKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetryReading" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelemetryReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pump" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "running" BOOLEAN NOT NULL DEFAULT false,
    "lastStatusAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pump_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PumpCommand" (
    "id" TEXT NOT NULL,
    "pumpId" TEXT NOT NULL,
    "action" "PumpCommandAction" NOT NULL,
    "source" "PumpCommandSource" NOT NULL,
    "status" "PumpCommandStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "failReason" TEXT,

    CONSTRAINT "PumpCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PumpTrigger" (
    "id" TEXT NOT NULL,
    "pumpId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "comparison" "TriggerComparison" NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "action" "PumpCommandAction" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "respectRuraflex" BOOLEAN NOT NULL DEFAULT false,
    "overrideThreshold" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PumpTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PumpSchedule" (
    "id" TEXT NOT NULL,
    "pumpId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PumpSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuraflexBand" (
    "id" TEXT NOT NULL,
    "season" "RuraflexSeason" NOT NULL,
    "dayType" "RuraflexDayType" NOT NULL,
    "period" "RuraflexPeriod" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RuraflexBand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelemetryDevice_topicKey_key" ON "TelemetryDevice"("topicKey");

-- CreateIndex
CREATE INDEX "TelemetryReading_deviceId_metric_recordedAt_idx" ON "TelemetryReading"("deviceId", "metric", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pump_deviceId_key" ON "Pump"("deviceId");

-- CreateIndex
CREATE INDEX "PumpCommand_pumpId_status_idx" ON "PumpCommand"("pumpId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RuraflexBand_season_dayType_startTime_key" ON "RuraflexBand"("season", "dayType", "startTime");

-- AddForeignKey
ALTER TABLE "TelemetryDevice" ADD CONSTRAINT "TelemetryDevice_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryReading" ADD CONSTRAINT "TelemetryReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "TelemetryDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pump" ADD CONSTRAINT "Pump_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pump" ADD CONSTRAINT "Pump_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "TelemetryDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PumpCommand" ADD CONSTRAINT "PumpCommand_pumpId_fkey" FOREIGN KEY ("pumpId") REFERENCES "Pump"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PumpCommand" ADD CONSTRAINT "PumpCommand_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PumpTrigger" ADD CONSTRAINT "PumpTrigger_pumpId_fkey" FOREIGN KEY ("pumpId") REFERENCES "Pump"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PumpTrigger" ADD CONSTRAINT "PumpTrigger_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "TelemetryDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PumpSchedule" ADD CONSTRAINT "PumpSchedule_pumpId_fkey" FOREIGN KEY ("pumpId") REFERENCES "Pump"("id") ON DELETE CASCADE ON UPDATE CASCADE;
