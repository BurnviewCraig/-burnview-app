import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Plain field edits (title/notes/dueDate/repeatDays/farmId) and the
// complete/reopen action share this endpoint, same as other simple entities
// in this app (e.g. order-numbers). `complete` is handled specially since
// the right update depends on whether the entry repeats:
//   - repeatDays set: roll dueDate forward by repeatDays FROM ITS OLD DUE
//     DATE (not from today) and record lastDoneAt; done stays false so the
//     entry keeps coming back on a fixed cadence.
//   - repeatDays null: just flip done to true/false.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const data: {
    title?: string;
    notes?: string | null;
    dueDate?: Date;
    repeatDays?: number | null;
    farmId?: string | null;
    done?: boolean;
    lastDoneAt?: Date;
  } = {};

  if ("title" in body) data.title = String(body.title).trim();
  if ("notes" in body) data.notes = body.notes ? String(body.notes).trim() : null;
  if ("dueDate" in body) data.dueDate = new Date(body.dueDate);
  if ("farmId" in body) data.farmId = body.farmId || null;
  if ("repeatDays" in body) data.repeatDays = body.repeatDays != null && body.repeatDays > 0 ? Math.round(body.repeatDays) : null;

  if ("complete" in body) {
    if (body.complete) {
      const current = await prisma.diaryEntry.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
      data.lastDoneAt = new Date();
      if (current.repeatDays) {
        const next = new Date(current.dueDate);
        next.setDate(next.getDate() + current.repeatDays);
        data.dueDate = next;
        data.done = false;
      } else {
        data.done = true;
      }
    } else {
      data.done = false;
    }
  }

  const diaryEntry = await prisma.diaryEntry.update({
    where: { id },
    data,
    include: { farm: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ diaryEntry });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.diaryEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
