import { daysBetween } from "@/lib/utils";

export const REPEAT_PRESETS = [
  { label: "Weekly", days: 7 },
  { label: "Monthly", days: 30 },
  { label: "3-monthly", days: 90 },
  { label: "6-monthly", days: 180 },
  { label: "Yearly", days: 365 },
];

export type DueTone = "overdue" | "today" | "soon" | "later";

// dueDate comes back from the API as a full ISO datetime string (Prisma
// DateTime @db.Date still serializes with a time/zone component) — always
// slice to the date portion before building a local Date from it, or the
// concatenated "T00:00:00" produces an Invalid Date.
export function dueLabel(dueDate: string, today: string): { text: string; tone: DueTone } {
  const diff = daysBetween(today, dueDate);
  if (diff === 0) return { text: "Due today", tone: "today" };
  if (diff < 0) return { text: `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} overdue`, tone: "overdue" };
  if (diff <= 7) return { text: `In ${diff} day${diff === 1 ? "" : "s"}`, tone: "soon" };
  const dt = new Date(dueDate.slice(0, 10) + "T00:00:00");
  return { text: dt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }), tone: "later" };
}
