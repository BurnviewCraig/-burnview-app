import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await prisma.dieselAsset.findUnique({
    where: { id },
    include: { farm: { select: { id: true, name: true } } },
  });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ asset });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: { name?: string; numberPlate?: string | null; unit?: "HOURS" | "KM"; active?: boolean; sortOrder?: number } = {};
  if ("name" in body) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
    data.name = name;
  }
  if ("numberPlate" in body) data.numberPlate = body.numberPlate?.trim() || null;
  if ("unit" in body) data.unit = body.unit === "KM" ? "KM" : "HOURS";
  if ("active" in body) data.active = !!body.active;
  if ("sortOrder" in body) data.sortOrder = Number(body.sortOrder);

  try {
    const asset = await prisma.dieselAsset.update({ where: { id }, data });
    return NextResponse.json({ asset });
  } catch {
    return NextResponse.json({ error: "An asset with that name already exists on this farm" }, { status: 409 });
  }
}

// Refuses to delete an asset with any logged history — these are SARS
// diesel-rebate records and shouldn't be destroyable by accident. Mark it
// inactive (PATCH active:false) instead to hide it from the daily list
// while keeping its history intact.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entryCount = await prisma.dieselLogEntry.count({ where: { assetId: id } });
  if (entryCount > 0) {
    return NextResponse.json(
      { error: `This asset has ${entryCount} logged ${entryCount === 1 ? "entry" : "entries"} — mark it inactive instead of deleting it.` },
      { status: 409 }
    );
  }
  await prisma.dieselAsset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
