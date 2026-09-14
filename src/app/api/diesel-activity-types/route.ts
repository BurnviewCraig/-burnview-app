import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const types = await prisma.dieselActivityType.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return NextResponse.json({ types });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name }: { name?: string } = body;
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  try {
    const count = await prisma.dieselActivityType.count();
    const type = await prisma.dieselActivityType.create({
      data: { name: name.trim(), sortOrder: count },
    });
    return NextResponse.json({ type });
  } catch {
    return NextResponse.json({ error: "That activity already exists" }, { status: 409 });
  }
}
