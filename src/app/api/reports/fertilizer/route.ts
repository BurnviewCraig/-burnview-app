import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withinRange } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Fertilizer program report — how much N/P/K/S has actually gone onto the
// ground, per camp and as a farm-wide area-weighted average, over a chosen
// period. Nutrient kg/ha for one application = product rate (kg/ha) × that
// fertilizer's nutrient % (see FertilizerType) — the same formula the farm
// map's per-paddock nutrient panel already uses, just totalled across every
// paddock in scope instead of one at a time.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");
  const range = searchParams.get("range") || "ytd";
  const scope = searchParams.get("scope") || "pasture"; // "pasture" | "all"

  const paddocks = await prisma.paddock.findMany({
    where: {
      ...(farmId && farmId !== "all" ? { farmId } : {}),
      ...(scope === "pasture" ? { landType: { in: ["Rye grass", "Kikuyu"] } } : {}),
    },
    include: { farm: { select: { name: true } } },
  });
  const paddockById = new Map(paddocks.map((p) => [p.id, p]));

  const activities = await prisma.fieldActivity.findMany({
    where: {
      type: "FERTILIZER",
      paddockId: { in: [...paddockById.keys()] },
    },
    select: { paddockId: true, date: true, product: true, rate: true },
  });
  const inRange = activities.filter((a) => a.rate && a.product && withinRange(a.date.toISOString(), range));

  const fertTypes = await prisma.fertilizerType.findMany();
  const fertByName = new Map(fertTypes.map((t) => [t.name, t]));
  const unrecognizedProducts = new Set<string>();
  const placeholderProducts = new Set<string>();

  type Totals = { N: number; P: number; K: number; S: number; count: number };
  const zero = (): Totals => ({ N: 0, P: 0, K: 0, S: 0, count: 0 });
  const byPaddock = new Map<string, Totals>();
  for (const p of paddockById.keys()) byPaddock.set(p, zero());

  for (const a of inRange) {
    const comp = fertByName.get(a.product!);
    if (!comp) unrecognizedProducts.add(a.product!);
    else if (comp.isPlaceholder) placeholderProducts.add(a.product!);
    const t = byPaddock.get(a.paddockId)!;
    t.N += (a.rate! * (comp?.nitrogenPct ?? 0)) / 100;
    t.P += (a.rate! * (comp?.phosphorusPct ?? 0)) / 100;
    t.K += (a.rate! * (comp?.potassiumPct ?? 0)) / 100;
    t.S += (a.rate! * (comp?.sulfurPct ?? 0)) / 100;
    t.count += 1;
  }

  const rows = [...paddockById.values()]
    .map((p) => {
      const t = byPaddock.get(p.id)!;
      return {
        paddockId: p.id,
        code: p.code,
        farmName: p.farm.name,
        landType: p.landType,
        sizeHa: p.sizeHa,
        applications: t.count,
        N: Math.round(t.N * 10) / 10,
        P: Math.round(t.P * 10) / 10,
        K: Math.round(t.K * 10) / 10,
        S: Math.round(t.S * 10) / 10,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  // Area-weighted average kg/ha — a camp with no size on file can't be
  // weighted, so it's excluded from the average (still shown in the table).
  const weighable = rows.filter((r) => r.sizeHa);
  const totalHa = weighable.reduce((s, r) => s + (r.sizeHa ?? 0), 0);
  const weightedAvg = (key: "N" | "P" | "K" | "S") =>
    totalHa > 0 ? Math.round((weighable.reduce((s, r) => s + r[key] * (r.sizeHa ?? 0), 0) / totalHa) * 10) / 10 : 0;

  const totals = {
    N: Math.round(rows.reduce((s, r) => s + r.N, 0) * 10) / 10,
    P: Math.round(rows.reduce((s, r) => s + r.P, 0) * 10) / 10,
    K: Math.round(rows.reduce((s, r) => s + r.K, 0) * 10) / 10,
    S: Math.round(rows.reduce((s, r) => s + r.S, 0) * 10) / 10,
  };
  const avgPerHa = { N: weightedAvg("N"), P: weightedAvg("P"), K: weightedAvg("K"), S: weightedAvg("S") };

  return NextResponse.json({
    rows,
    totals,
    avgPerHa,
    totalHa: Math.round(totalHa * 10) / 10,
    excludedNoSize: rows.length - weighable.length,
    unrecognizedProducts: [...unrecognizedProducts],
    placeholderProducts: [...placeholderProducts],
  });
}
