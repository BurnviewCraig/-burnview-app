import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const { farmId, code, sizeHa, landType } = body as {
    farmId?: string;
    code?: string;
    sizeHa?: number | string | null;
    landType?: string | null;
  };

  const trimmedCode = String(code ?? "").trim();
  if (!farmId || !trimmedCode) {
    return NextResponse.json({ error: "Farm and code are required" }, { status: 400 });
  }

  try {
    const paddock = await prisma.paddock.create({
      data: {
        farmId,
        code: trimmedCode,
        sizeHa: sizeHa != null && sizeHa !== "" ? Number(sizeHa) : null,
        landType: landType || null,
      },
    });
    return NextResponse.json({ paddock });
  } catch {
    return NextResponse.json({ error: "A paddock with that code already exists on this farm" }, { status: 409 });
  }
}
