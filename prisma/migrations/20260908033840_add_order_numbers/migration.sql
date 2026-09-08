-- CreateTable
CREATE TABLE "OrderNumber" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "company" TEXT,
    "item" TEXT,
    "comment" TEXT,
    "farmId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderNumber_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrderNumber" ADD CONSTRAINT "OrderNumber_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderNumber" ADD CONSTRAINT "OrderNumber_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
