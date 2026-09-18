import { NextResponse } from "next/server";
import type { StockItem, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";
import { LAND_PREP_METHODS, CROP_TO_LAND_TYPE } from "@/lib/constants";
import { maizeSeasonFor } from "@/lib/maizeSeason";

// Keeps each maize field's season record in step with the activities
// actually logged against it — see the MaizeFieldSeason model comment for
// which fields come from where. Only ever touches a paddock that's
// already got a maize season on file (planting creates that first), so
// this is a no-op for every other crop.
// Maps the Spraying form's optional purpose chip to the MaizeFieldSeason
// date field it fills — explicit, rather than guessing from date order, so
// it's only ever as accurate as what was actually tagged.
const SPRAY_PURPOSE_FIELD: Record<string, "burndownDate" | "preGerminationSprayDate" | "firstPostSprayDate" | "lastTractorEntryDate"> = {
  "Burndown": "burndownDate",
  "Pre-Germination Spray": "preGerminationSprayDate",
  "1st Post Spray": "firstPostSprayDate",
  "Last tractor entry spray": "lastTractorEntryDate",
};

async function autoPopulateMaize(
  tx: Prisma.TransactionClient,
  { farmId, paddockId, type, date, mix, sprayPurpose }: {
    farmId: string;
    paddockId: string;
    type: string;
    date: string;
    mix?: { crop: string; variety: string | null; rate: number; unit: string }[];
    sprayPurpose?: string | null;
  }
) {
  const activityDate = new Date(date);

  if (type === "PLANTING") {
    const maizeRow = mix?.find((m) => m.crop === "Maize" && Number(m.rate) > 0);
    if (!maizeRow) return;
    const season = maizeSeasonFor(activityDate);
    const population = Number(maizeRow.rate);

    // Look up the variety's own maturity length and per-bag pricing so
    // planting can fill in an estimate and lock in what this seed actually
    // cost — snapshotted here, not looked up live later, so a subsequent
    // price change in Settings never rewrites an already-planted field.
    const variety = maizeRow.variety
      ? await tx.seedVariety.findFirst({ where: { cropType: "Maize", name: maizeRow.variety } })
      : null;
    const estMaturityDate = variety?.daysToMaturity
      ? new Date(activityDate.getTime() + variety.daysToMaturity * 86400000)
      : undefined;
    const seedCostPerHa =
      variety?.costPerBag && variety.seedsPerBag ? (population / variety.seedsPerBag) * variety.costPerBag : undefined;

    const data = {
      variety: maizeRow.variety || null,
      plantDate: activityDate,
      population,
      ...(estMaturityDate ? { estMaturityDate } : {}),
      ...(seedCostPerHa != null ? { seedCostPerHa: Math.round(seedCostPerHa * 100) / 100 } : {}),
    };
    await tx.maizeFieldSeason.upsert({
      where: { paddockId_season: { paddockId, season } },
      update: data,
      create: { farmId, paddockId, season, ...data },
    });
    return;
  }

  if (type !== "SPRAYING" && type !== "FERTILIZER") return;

  const current = await tx.maizeFieldSeason.findFirst({
    where: { paddockId, plantDate: { lte: activityDate } },
    orderBy: { plantDate: "desc" },
  });
  if (!current) return;

  if (type === "SPRAYING") {
    const field = sprayPurpose ? SPRAY_PURPOSE_FIELD[sprayPurpose] : null;
    if (field) await tx.maizeFieldSeason.update({ where: { id: current.id }, data: { [field]: activityDate } });
  } else if (current.plantDate && activityDate > current.plantDate) {
    // Fertilizer applied after planting is assumed to be top-dressing — a
    // basal application at/before planting doesn't count as either date.
    if (!current.firstTopDressingDate) {
      await tx.maizeFieldSeason.update({ where: { id: current.id }, data: { firstTopDressingDate: activityDate } });
    } else if (!current.secondTopDressingDate && activityDate > current.firstTopDressingDate) {
      await tx.maizeFieldSeason.update({ where: { id: current.id }, data: { secondTopDressingDate: activityDate } });
    }
  }
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const paddockId = searchParams.get("paddockId");
  const farmId = searchParams.get("farmId");

  const activities = await prisma.fieldActivity.findMany({
    where: {
      ...(paddockId ? { paddockId } : {}),
      ...(farmId ? { farmId } : {}),
    },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ activities });
}

export async function POST(req: Request) {
  const body = await req.json();
  const {
    farmId,
    paddockIds,
    type,
    date,
    notes,
    product,
    rate,
    method,
    depth,
    mix,
    chemicals,
    sprayPurpose,
    bales,
  }: {
    farmId: string;
    paddockIds: string[];
    type: "FERTILIZER" | "MULCHING" | "PLANTING" | "LAND_PREP" | "SPRAYING" | "MOWING" | "BAILING";
    date: string;
    notes?: string;
    product?: string;
    rate?: number;
    method?: string;
    depth?: number;
    mix?: { crop: string; variety: string | null; rate: number; unit: string }[];
    chemicals?: { name: string; rate: number; unit: string }[];
    sprayPurpose?: string | null;
    bales?: number;
  } = body;

  if (!farmId || !paddockIds?.length || !type || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (type === "BAILING" && (!product || !bales || bales <= 0)) {
    return NextResponse.json({ error: "Bale type and a bale count are required" }, { status: 400 });
  }

  const userId = await currentUserId();

  let bailingStockItem: StockItem | null = null;
  if (type === "BAILING") {
    bailingStockItem = await prisma.stockItem.findFirst({ where: { kind: "FEED", name: product } });
    if (!bailingStockItem) {
      return NextResponse.json({ error: `No feed stock item named "${product}" — add it in Stocks first.` }, { status: 400 });
    }
  }

  const majorityCrop = (() => {
    if (type !== "PLANTING" || !mix?.length) return null;
    const valid = mix.filter((m) => Number(m.rate) > 0);
    if (!valid.length) return null;
    const top = valid.reduce((a, b) => (Number(b.rate) > Number(a.rate) ? b : a));
    return CROP_TO_LAND_TYPE[top.crop] ?? null;
  })();

  const isTillage = type === "LAND_PREP" && LAND_PREP_METHODS.find((m) => m.name === method)?.tillage === true;

  const created = await prisma.$transaction(async (tx) => {
    const entries = [];
    for (const paddockId of paddockIds) {
      const entry = await tx.fieldActivity.create({
        data: {
          farmId,
          paddockId,
          type,
          date: new Date(date),
          notes: notes || null,
          product: type === "FERTILIZER" || type === "BAILING" ? product : null,
          rate: type === "FERTILIZER" ? rate ?? null : null,
          method: type === "LAND_PREP" ? method : null,
          depth: type === "LAND_PREP" ? depth ?? null : null,
          mix: type === "PLANTING" ? mix : undefined,
          chemicals: type === "SPRAYING" ? chemicals : undefined,
          sprayPurpose: type === "SPRAYING" ? sprayPurpose || null : null,
          bales: type === "BAILING" ? bales ?? null : null,
          createdById: userId,
        },
      });
      entries.push(entry);

      await autoPopulateMaize(tx, { farmId, paddockId, type, date, mix, sprayPurpose });

      if (isTillage) {
        await tx.paddock.update({ where: { id: paddockId }, data: { landType: "Unplanted" } });
      } else if (majorityCrop) {
        await tx.paddock.update({ where: { id: paddockId }, data: { landType: majorityCrop } });
      }

      if (type === "BAILING" && bailingStockItem && bales) {
        bailingStockItem = await tx.stockItem.update({ where: { id: bailingStockItem.id }, data: { qty: bailingStockItem.qty + bales } });
        await tx.stockEntry.create({
          data: {
            itemId: bailingStockItem.id,
            mode: "RESTOCK",
            qty: bales,
            date: new Date(date),
            farmId,
            paddockId,
            fieldActivityId: entry.id,
            createdById: userId,
          },
        });
      }
    }
    return entries;
  });

  return NextResponse.json({ activities: created });
}
