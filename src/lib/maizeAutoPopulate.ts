import type { Prisma } from "@prisma/client";

// Maps the Spraying form's optional purpose chip to the MaizeFieldSeason
// date field it fills — explicit, rather than guessing from date order, so
// it's only ever as accurate as what was actually tagged.
export const SPRAY_PURPOSE_FIELD: Record<string, "burndownDate" | "preGerminationSprayDate" | "firstPostSprayDate" | "lastTractorEntryDate"> = {
  "Burndown": "burndownDate",
  "Pre-Germination Spray": "preGerminationSprayDate",
  "1st Post Spray": "firstPostSprayDate",
  "Last tractor entry spray": "lastTractorEntryDate",
};

// Fertilizer within this many days of planting is treated as a starter/
// correction dose, not top-dressing — true top-dressing happens weeks
// later at a specific growth stage. Without this, a MAP correction applied
// 3 days after planting (real example: Burnview's Mingay 1) got recorded
// as "first top-dressing", which it wasn't.
export const TOP_DRESS_MIN_DAYS_AFTER_PLANTING = 10;

// Burndown kills off the previous crop ahead of land prep, so it normally
// happens WEEKS BEFORE planting — there's no MaizeFieldSeason row yet to
// attach it to at the time it's logged (real example: Burnview's M11,
// burndown sprayed 14 days before planting). So unlike the other three
// spray purposes (which only ever happen at/after planting), burndown is
// looked for in a window BEFORE each season's plantDate, not after it.
// Capped at the previous season's own plantDate (so it can't reach back
// into an earlier rotation) or this many days back if there's no
// previous season on file.
export const BURNDOWN_LOOKBACK_DAYS = 90;

// Re-derives every spray-purpose date and both top-dressing dates for a
// paddock's maize season(s) from its CURRENT FieldActivity rows, rather
// than incrementally patching one field forward as each activity comes in.
// Call this after any create/edit/delete of a SPRAYING or FERTILIZER
// activity on a maize paddock, and after a new PLANTING (a burndown logged
// before that planting existed had nothing to attach to yet) — it's the
// only way these fields stay correct when an entry gets corrected or
// removed after the fact (a one-way "set the date when it happens" never
// un-sets it, which is why deleting a mistaken calendar entry previously
// left Maize History unchanged). Does not touch plantDate/variety/
// population/estMaturityDate/seedCostPerHa — those are still set only by
// the PLANTING activity itself.
export async function recomputeMaizeDerivedFields(tx: Prisma.TransactionClient, paddockId: string) {
  const seasons = await tx.maizeFieldSeason.findMany({ where: { paddockId }, orderBy: { plantDate: "asc" } });
  const withPlantDate = seasons.filter((s) => s.plantDate != null);
  if (!withPlantDate.length) return;

  const activities = await tx.fieldActivity.findMany({
    where: { paddockId, type: { in: ["SPRAYING", "FERTILIZER"] } },
    orderBy: { date: "asc" },
  });

  for (let i = 0; i < withPlantDate.length; i++) {
    const season = withPlantDate[i];
    const plantDate = season.plantDate!;
    const prev = withPlantDate[i - 1];
    const next = withPlantDate[i + 1];
    // Everything from this season's planting up to (not including) the
    // next season's planting belongs to this season — same bucketing rule
    // live auto-populate already used (most recent plantDate <= activity
    // date), just applied to the whole activity list at once.
    const inSeason = activities.filter((a) => a.date >= plantDate && (!next || a.date < next.plantDate!));

    const burndownWindowStart = prev?.plantDate ?? new Date(plantDate.getTime() - BURNDOWN_LOOKBACK_DAYS * 86400000);
    const burndownCandidates = activities.filter(
      (a) => a.type === "SPRAYING" && a.sprayPurpose === "Burndown" && a.date >= burndownWindowStart && a.date < plantDate
    );
    const burndownDate = burndownCandidates.length ? burndownCandidates[burndownCandidates.length - 1].date : null;

    const sprayDates: Record<string, Date | null> = {
      preGerminationSprayDate: null,
      firstPostSprayDate: null,
      lastTractorEntryDate: null,
    };
    for (const a of inSeason) {
      if (a.type !== "SPRAYING" || !a.sprayPurpose || a.sprayPurpose === "Burndown") continue;
      const field = SPRAY_PURPOSE_FIELD[a.sprayPurpose];
      if (field) sprayDates[field] = a.date; // ascending order, so the latest tagged spray wins
    }

    const topDressDates = inSeason
      .filter((a) => a.type === "FERTILIZER" && a.date.getTime() - plantDate.getTime() >= TOP_DRESS_MIN_DAYS_AFTER_PLANTING * 86400000)
      .map((a) => a.date);

    await tx.maizeFieldSeason.update({
      where: { id: season.id },
      data: {
        burndownDate,
        preGerminationSprayDate: sprayDates.preGerminationSprayDate,
        firstPostSprayDate: sprayDates.firstPostSprayDate,
        lastTractorEntryDate: sprayDates.lastTractorEntryDate,
        firstTopDressingDate: topDressDates[0] ?? null,
        secondTopDressingDate: topDressDates[1] ?? null,
      },
    });
  }
}
