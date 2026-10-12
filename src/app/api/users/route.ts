import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const users = await prisma.user.findMany({
    select: { id: true, username: true, name: true, createdAt: true, isAdmin: true, sectionAccess: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await req.json();
  const { username, name, password } = body as { username: string; name: string; password: string };
  if (!username?.trim() || !name?.trim() || !password || password.length < 6) {
    return NextResponse.json({ error: "Username, name and a password of at least 6 characters are required" }, { status: 400 });
  }
  const normalized = username.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { username: normalized } });
  if (existing) {
    return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username: normalized, name: name.trim(), passwordHash },
    select: { id: true, username: true, name: true, createdAt: true, isAdmin: true, sectionAccess: true },
  });
  return NextResponse.json({ user });
}
