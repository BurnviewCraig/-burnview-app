import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const farmId = searchParams.get("farmId");
  const section = searchParams.get("section");
  const includeInactive = searchParams.get("includeInactive") === "true";
  const workers = await prisma.worker.findMany({
    where: {
      ...(farmId ? { farmId } : {}),
      ...(section ? { section: section as "DAIRY" | "STAFF" | "TOGH" } : {}),
      ...(includeInactive ? {} : { active: true }),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ workers });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { farmId, section, name, role, notes } = body as {
    farmId?: string;
    section?: string;
    name?: string;
    role?: string;
    notes?: string;
  };
  if (!farmId || !section || !name?.trim()) {
    return NextResponse.json({ error: "Farm, section and name are required" }, { status: 400 });
  }
  const worker = await prisma.worker.create({
    data: {
      farmId,
      section: section as "DAIRY" | "STAFF" | "TOGH",
      name: name.trim(),
      role: role?.trim() || null,
      notes: notes?.trim() || null,
    },
  });
  return NextResponse.json({ worker });
}
