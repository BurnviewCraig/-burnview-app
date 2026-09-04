import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const types = await prisma.chemicalType.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ types });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, unit }: { name: string; unit?: string } = body;
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  try {
    const type = await prisma.chemicalType.create({
      data: { name: name.trim(), unit: unit?.trim() || "L/ha" },
    });
    return NextResponse.json({ type });
  } catch {
    return NextResponse.json({ error: "A chemical with that name already exists" }, { status: 409 });
  }
}
