import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  const items = await prisma.stockItem.findMany({
    where: kind ? { kind: kind as "FEED" | "LAND_INPUT" } : undefined,
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { kind, category, name, unit } = body as {
    kind: "FEED" | "LAND_INPUT";
    category?: string;
    name: string;
    unit: string;
  };
  if (!kind || !name?.trim() || !unit) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const item = await prisma.stockItem.create({
    data: { kind, category: category || null, name: name.trim(), unit, qty: 0 },
  });
  return NextResponse.json({ item });
}
