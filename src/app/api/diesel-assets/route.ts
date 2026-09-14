import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");
  const includeInactive = searchParams.get("includeInactive") === "true";
  if (!farmId) {
    return NextResponse.json({ error: "farmId is required" }, { status: 400 });
  }
  const assets = await prisma.dieselAsset.findMany({
    where: { farmId, ...(includeInactive ? {} : { active: true }) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ assets });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { farmId, name, numberPlate, unit }: { farmId?: string; name?: string; numberPlate?: string; unit?: string } = body;
  if (!farmId || !name?.trim()) {
    return NextResponse.json({ error: "Farm and name are required" }, { status: 400 });
  }
  try {
    const asset = await prisma.dieselAsset.create({
      data: {
        farmId,
        name: name.trim(),
        numberPlate: numberPlate?.trim() || null,
        unit: unit === "KM" ? "KM" : "HOURS",
      },
    });
    return NextResponse.json({ asset });
  } catch {
    return NextResponse.json({ error: "An asset with that name already exists on this farm" }, { status: 409 });
  }
}
