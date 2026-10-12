import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();

  const data: Prisma.UserUpdateInput = {};

  if ("name" in body) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
    data.name = name;
  }
  if ("username" in body) {
    const username = String(body.username).trim().toLowerCase();
    if (!username) return NextResponse.json({ error: "Username can't be empty" }, { status: 400 });
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
    }
    data.username = username;
  }
  if ("password" in body && body.password) {
    if (String(body.password).length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }
  if ("isAdmin" in body) {
    // Guard against locking everyone out of admin — can't demote yourself
    // if you're the last remaining admin.
    if (id === adminId && body.isAdmin === false) {
      const otherAdmins = await prisma.user.count({ where: { isAdmin: true, id: { not: id } } });
      if (otherAdmins === 0) {
        return NextResponse.json({ error: "There must be at least one admin — promote someone else first" }, { status: 400 });
      }
    }
    data.isAdmin = Boolean(body.isAdmin);
  }
  if ("sectionAccess" in body) {
    data.sectionAccess = body.sectionAccess === null ? Prisma.DbNull : body.sectionAccess;
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, name: true, createdAt: true, isAdmin: true, sectionAccess: true },
  });
  return NextResponse.json({ user });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const { id } = await params;

  if (id === adminId) {
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  }
  const target = await prisma.user.findUnique({ where: { id }, select: { isAdmin: true } });
  if (target?.isAdmin) {
    const otherAdmins = await prisma.user.count({ where: { isAdmin: true, id: { not: id } } });
    if (otherAdmins === 0) {
      return NextResponse.json({ error: "There must be at least one admin" }, { status: 400 });
    }
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
