import { NextResponse } from "next/server";
import type { StockItem, Prisma, MaizeFieldSeason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";
import { LAND_PREP_METHODS, CROP_TO_LAND_TYPE } from "@/lib/constants";
import { maizeSeasonFor } from "@/lib/maizeSeason";

// Maps the Spraying form's optional purpose chip to the MaizeFieldSeason
// date field it fills — explicit, rather than guessing from date order, so
// it's only ever as accurate as what was actually tagged.
const SPRAY_PURPOSE_FIELD: Record<string, "burndownDate" | "preGerminationSprayDate" | "firstPostSprayDate" | "lastTractorEntryDate"> = {
  "Burndown": "burndownDate",
  "Pre-Germination Spray": "preGerminationSprayDate",
  "1st Post Spray": "firstPostSprayDate",
  "Last tractor entry spray": "lastTractorEntryDate",
};

// Keeps each maize field's season record in step with the activities
// actually logged against it — see the MaizeFieldSeason model comment for
// which fields come from where. Batched across the whole paddockIds list
// (a handful of bulk queries) rather than queried per paddock — logging
// one activity against a whole pivot/section (dozens of camps at once) was
// enough round trips to Neon to blow through Prisma's interactive
// transaction time limit and fail outright with "Transaction not found".
async function autoPopulateMaizeBatch(
  tx: Prisma.TransactionClient,
  { farmId, paddockIds, type, date, mix, sprayPurpose }: {
    farmId: string;
    paddockIds: string[];
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

    // Same mix, same date for every paddock in the batch, so the data to
    // write is identical for all of them — only which ones already have a
    // row for this season (update) vs. don't (create) differs.
    const data = {
      variety: maizeRow.variety || null,
      plantDate: activityDate,
      population,
      ...(estMaturityDate ? { estMaturityDate } : {}),
      ...(seedCostPerHa != null ? { seedCostPerHa: Math.round(seedCostPerHa * 100) / 100 } : {}),
    };

    const existing = await tx.maizeFieldSeason.findMany({
      where: { paddockId: { in: paddockIds }, season },
      select: { paddockId: true },
    });
    const existingIds = new Set(existing.map((e) => e.paddockId));
    const toCreate = paddockIds.filter((id) => !existingIds.has(id));

    if (existingIds.size > 0) {
      await tx.maizeFieldSeason.updateMany({ where: { paddockId: { in: [...existingIds] }, season }, data });
    }
    if (toCreate.length > 0) {
      await tx.maizeFieldSeason.createMany({ data: toCreate.map((paddockId) => ({ farmId, paddockId, season, ...data })) });
    }
    return;
  }

  if (type !== "SPRAYING" && type !== "FERTILIZER") return;

  const candidates = await tx.maizeFieldSeason.findMany({
    where: { paddockId: { in: paddockIds }, plantDate: { lte: activityDate } },
    orderBy: { plantDate: "desc" },
  });
  const currentByPaddock = new Map<string, MaizeFieldSeason>();
  for (const c of candidates) {
    if (!currentByPaddock.has(c.paddockId)) currentByPaddock.set(c.paddockId, c);
  }
  if (currentByPaddock.size === 0) return;

  if (type === "SPRAYING") {
    const field = sprayPurpose ? SPRAY_PURPOSE_FIELD[sprayPurpose] : null;
    if (!field) return;
    const ids = [...currentByPaddock.values()].map((c) => c.id);
    await tx.maizeFieldSeason.updateMany({ where: { id: { in: ids } }, data: { [field]: activityDate } });
    return;
  }

  // Fertilizer applied after planting is assumed to be top-dressing — a
  // basal application at/before planting doesn't count as either date.
  // Each record's own state decides whether it still needs a first or
  // second top-dressing date, so the batch splits into two update groups.
  const needsFirst: string[] = [];
  const needsSecond: string[] = [];
  for (const c of currentByPaddock.values()) {
    if (!c.plantDate || activityDate <= c.plantDate) continue;
    if (!c.firstTopDressingDate) needsFirst.push(c.id);
    else if (!c.secondTopDressingDate && c.firstTopDressingDate && activityDate > c.firstTopDressingDate) needsSecond.push(c.id);
  }
  if (needsFirst.length) await tx.maizeFieldSeason.updateMany({ where: { id: { in: needsFirst } }, data: { firstTopDressingDate: activityDate } });
  if (needsSecond.length) await tx.maizeFieldSeason.updateMany({ where: { id: { in: needsSecond } }, data: { secondTopDressingDate: activityDate } });
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

  // Bailing always logs one paddock at a time from the client (each camp's
  // bale count is its own row), and needs each entry's own id right away to
  // link the stock restock it creates — so it keeps the original per-paddock
  // path. Everything else is batched: one createMany for the activities, a
  // few bulk queries for the maize side effects, one updateMany for any
  // paddock reclassification — a handful of round trips no matter how many
  // camps (a whole pivot, a whole farm) are selected at once.
  if (type === "BAILING") {
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
            product: product ?? null,
            bales: bales ?? null,
            createdById: userId,
          },
        });
        entries.push(entry);

        if (bailingStockItem && bales) {
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
    }, { timeout: 30000, maxWait: 10000 });
    return NextResponse.json({ activities: created });
  }

  await prisma.$transaction(async (tx) => {
    await tx.fieldActivity.createMany({
      data: paddockIds.map((paddockId) => ({
        farmId,
        paddockId,
        type,
        date: new Date(date),
        notes: notes || null,
        product: type === "FERTILIZER" ? product : null,
        rate: type === "FERTILIZER" ? rate ?? null : null,
        method: type === "LAND_PREP" ? method : null,
        depth: type === "LAND_PREP" ? depth ?? null : null,
        mix: type === "PLANTING" ? mix : undefined,
        chemicals: type === "SPRAYING" ? chemicals : undefined,
        sprayPurpose: type === "SPRAYING" ? sprayPurpose || null : null,
        bales: null,
        createdById: userId,
      })),
    });

    await autoPopulateMaizeBatch(tx, { farmId, paddockIds, type, date, mix, sprayPurpose });

    if (isTillage) {
      await tx.paddock.updateMany({ where: { id: { in: paddockIds } }, data: { landType: "Unplanted" } });
    } else if (majorityCrop) {
      await tx.paddock.updateMany({ where: { id: { in: paddockIds } }, data: { landType: majorityCrop } });
    }
  }, { timeout: 30000, maxWait: 10000 });

  return NextResponse.json({ ok: true });
}
