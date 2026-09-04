import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cropType = searchParams.get("cropType");
  const varieties = await prisma.seedVariety.findMany({
    where: cropType ? { cropType } : undefined,
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ varieties });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { cropType, name } = body as { cropType: string; name: string };
  if (!cropType?.trim() || !name?.trim()) {
    return NextResponse.json({ error: "Crop and name are required" }, { status: 400 });
  }
  try {
    const variety = await prisma.seedVariety.create({ data: { cropType: cropType.trim(), name: name.trim() } });
    return NextResponse.json({ variety });
  } catch {
    return NextResponse.json({ error: "That variety already exists for this crop" }, { status: 409 });
  }
}
