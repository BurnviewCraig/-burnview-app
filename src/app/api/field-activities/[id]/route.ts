import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";
import { LAND_PREP_METHODS, CROP_TO_LAND_TYPE } from "@/lib/constants";

type MixItem = { crop: string; variety: string | null; rate: number; unit: string };
type ChemItem = { name: string; rate: number; unit: string };

function computeMajorityLandType(mix?: MixItem[] | null): string | null {
  if (!mix?.length) return null;
  const valid = mix.filter((m) => Number(m.rate) > 0);
  if (!valid.length) return null;
  const top = valid.reduce((a, b) => (Number(b.rate) > Number(a.rate) ? b : a));
  return CROP_TO_LAND_TYPE[top.crop] ?? null;
}

// Only fields actually present in the body are touched — lets a bulk edit
// change just one field (e.g. rate) across many entries without clobbering
// everything else back to null.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const {
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
    date?: string;
    notes?: string | null;
    product?: string | null;
    rate?: number | null;
    method?: string | null;
    depth?: number | null;
    mix?: MixItem[];
    chemicals?: ChemItem[];
    bales?: number | null;
  } = body;

  const existing = await prisma.fieldActivity.findUnique({ where: { id }, include: { stockEntry: true } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const touchesBailingFields = existing.type === "BAILING" && ("product" in body || "bales" in body);
  if (touchesBailingFields) {
    const effectiveProduct = "product" in body ? product : existing.product;
    const effectiveBales = "bales" in body ? bales : existing.bales;
    if (!effectiveProduct || !effectiveBales || effectiveBales <= 0) {
      return NextResponse.json({ error: "Bale type and a bale count are required" }, { status: 400 });
    }
    if (existing.stockEntry) {
      const newItem = await prisma.stockItem.findFirst({ where: { kind: "FEED", name: effectiveProduct } });
      if (!newItem) {
        return NextResponse.json({ error: `No feed stock item named "${effectiveProduct}" — add it in Stocks first.` }, { status: 400 });
      }
    }
  }

  const userId = await currentUserId();

  const isTillage = "method" in body && existing.type === "LAND_PREP" && LAND_PREP_METHODS.find((m) => m.name === method)?.tillage === true;
  const majorityLandType = "mix" in body && existing.type === "PLANTING" ? computeMajorityLandType(mix) : null;

  const updated = await prisma.$transaction(async (tx) => {
    if (touchesBailingFields && existing.stockEntry) {
      const effectiveProduct = ("product" in body ? product : existing.product)!;
      const effectiveBales = ("bales" in body ? bales : existing.bales)!;
      const oldItem = await tx.stockItem.findUnique({ where: { id: existing.stockEntry.itemId } });
      if (oldItem) {
        await tx.stockItem.update({ where: { id: oldItem.id }, data: { qty: oldItem.qty - existing.stockEntry.qty } });
      }
      const newItem = await tx.stockItem.findFirst({ where: { kind: "FEED", name: effectiveProduct } });
      await tx.stockItem.update({ where: { id: newItem!.id }, data: { qty: newItem!.qty + effectiveBales } });
      await tx.stockEntry.update({
        where: { id: existing.stockEntry.id },
        data: { itemId: newItem!.id, qty: effectiveBales, date: date ? new Date(date) : existing.date },
      });
    }

    const data: Record<string, unknown> = {};
    if ("date" in body && date) data.date = new Date(date);
    if ("notes" in body) data.notes = notes || null;
    if ("product" in body && (existing.type === "FERTILIZER" || existing.type === "BAILING")) data.product = product ?? null;
    if ("rate" in body && existing.type === "FERTILIZER") data.rate = rate ?? null;
    if ("method" in body && existing.type === "LAND_PREP") data.method = method ?? null;
    if ("depth" in body && existing.type === "LAND_PREP") data.depth = depth ?? null;
    if ("mix" in body && existing.type === "PLANTING") data.mix = mix;
    if ("chemicals" in body && existing.type === "SPRAYING") data.chemicals = chemicals;
    if ("bales" in body && existing.type === "BAILING") data.bales = bales ?? null;
    if (!existing.createdById) data.createdById = userId;

    const entry = await tx.fieldActivity.update({ where: { id }, data });

    if (isTillage) {
      await tx.paddock.update({ where: { id: existing.paddockId }, data: { landType: "Unplanted" } });
    } else if (majorityLandType) {
      await tx.paddock.update({ where: { id: existing.paddockId }, data: { landType: majorityLandType } });
    }

    return entry;
  });

  return NextResponse.json({ activity: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const existing = await prisma.fieldActivity.findUnique({ where: { id }, include: { stockEntry: true } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    if (existing.type === "BAILING" && existing.stockEntry) {
      const item = await tx.stockItem.findUnique({ where: { id: existing.stockEntry.itemId } });
      if (item) {
        await tx.stockItem.update({ where: { id: item.id }, data: { qty: Math.max(0, item.qty - existing.stockEntry!.qty) } });
      }
    }
    // Deleting the FieldActivity cascades to its StockEntry automatically.
    await tx.fieldActivity.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
