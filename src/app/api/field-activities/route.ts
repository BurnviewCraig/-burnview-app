import { NextResponse } from "next/server";
import type { StockItem } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";
import { LAND_PREP_METHODS, CROP_TO_LAND_TYPE } from "@/lib/constants";

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
          bales: type === "BAILING" ? bales ?? null : null,
          createdById: userId,
        },
      });
      entries.push(entry);

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
