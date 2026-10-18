import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

// Active entries by default (done=false — recurring entries never flip this,
// they just roll their dueDate forward, so only finished one-offs are ever
// hidden this way). ?includeDone=1 also returns those, for a history view.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeDone = searchParams.get("includeDone") === "1";

  const diaryEntries = await prisma.diaryEntry.findMany({
    where: includeDone ? undefined : { done: false },
    orderBy: { dueDate: "asc" },
    include: { farm: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ diaryEntries });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const title = (body as { title?: string }).title?.trim();
  const dueDate = (body as { dueDate?: string }).dueDate;
  if (!title || !dueDate) {
    return NextResponse.json({ error: "title and dueDate are required" }, { status: 400 });
  }
  const notes = (body as { notes?: string }).notes?.trim() || null;
  const farmId = (body as { farmId?: string }).farmId || null;
  const repeatDaysRaw = (body as { repeatDays?: number | null }).repeatDays;
  const repeatDays = repeatDaysRaw != null && repeatDaysRaw > 0 ? Math.round(repeatDaysRaw) : null;

  const userId = await currentUserId();
  const diaryEntry = await prisma.diaryEntry.create({
    data: { title, notes, dueDate: new Date(dueDate), farmId, repeatDays, createdById: userId },
    include: { farm: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ diaryEntry });
}
