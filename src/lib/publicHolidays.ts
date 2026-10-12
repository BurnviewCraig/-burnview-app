// South African public holidays — fixed-date ones, plus the two
// Easter-linked ones (Good Friday, Family Day/Easter Monday) South Africa
// observes. By law, a public holiday that falls on a Sunday rolls the
// following Monday into a holiday too — that's handled below as well.
// Used only to decide which overtime rate a day's hours fall under
// (Mon-Sat normal vs Sunday/public-holiday), not for anything else.

function easterSunday(year: number): { month: number; day: number } {
  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function addDaysUTC(y: number, m: number, d: number, delta: number): { y: number; m: number; d: number } {
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

const FIXED_HOLIDAYS: { month: number; day: number; name: string }[] = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 3, day: 21, name: "Human Rights Day" },
  { month: 4, day: 27, name: "Freedom Day" },
  { month: 5, day: 1, name: "Workers' Day" },
  { month: 6, day: 16, name: "Youth Day" },
  { month: 8, day: 9, name: "National Women's Day" },
  { month: 9, day: 24, name: "Heritage Day" },
  { month: 12, day: 16, name: "Day of Reconciliation" },
  { month: 12, day: 25, name: "Christmas Day" },
  { month: 12, day: 26, name: "Day of Goodwill" },
];

function holidaysForYear(year: number): Set<string> {
  const dates = new Set<string>();
  const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dayOfWeek = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday

  for (const h of FIXED_HOLIDAYS) {
    dates.add(iso(year, h.month, h.day));
    if (dayOfWeek(year, h.month, h.day) === 0) {
      const mon = addDaysUTC(year, h.month, h.day, 1);
      dates.add(iso(mon.y, mon.m, mon.d));
    }
  }

  const easter = easterSunday(year);
  const goodFriday = addDaysUTC(year, easter.month, easter.day, -2);
  const familyDay = addDaysUTC(year, easter.month, easter.day, 1);
  dates.add(iso(goodFriday.y, goodFriday.m, goodFriday.d));
  dates.add(iso(familyDay.y, familyDay.m, familyDay.d)); // Easter Monday never falls on a Sunday itself

  return dates;
}

const cache = new Map<number, Set<string>>();

export function isSouthAfricanPublicHoliday(dateStr: string): boolean {
  const year = Number(dateStr.slice(0, 4));
  if (!cache.has(year)) cache.set(year, holidaysForYear(year));
  return cache.get(year)!.has(dateStr);
}

// Sunday or a public holiday — the "different overtime rate" days.
export function isOvertimePremiumDay(dateStr: string): boolean {
  const dow = new Date(dateStr + "T00:00:00Z").getUTCDay();
  return dow === 0 || isSouthAfricanPublicHoliday(dateStr);
}
