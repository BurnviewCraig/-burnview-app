// Pasture growth rate, worked out the way a proper grazing wedge (e.g.
// Fourth Quadrant) does it: raw cover delta between two walks understates
// growth on any paddock that got grazed in between, since the herd removed
// dry matter that did grow. Adding back what was eaten corrects for that:
//
//   growth = (coverNow - coverPrevious + dmRemovedPerHa) / daysBetweenWalks
//
// dmRemovedPerHa comes from the paddock's actual GrazingAllocation history
// in that window — each DAY or NIGHT session removes half a day's intake
// for whichever group grazed it, using a standard per-cow DM intake
// estimate (this app doesn't measure actual intake).
export const PASTURE_INTAKE_KG_PER_COW_PER_DAY = 14;
const INTAKE_PER_SESSION = PASTURE_INTAKE_KG_PER_COW_PER_DAY / 2;

export function correctedGrowthPerDay({
  coverNow,
  coverPrevious,
  days,
  sizeHa,
  sessionsGrazed,
}: {
  coverNow: number;
  coverPrevious: number;
  days: number;
  sizeHa: number;
  // One entry per grazing session (DAY or NIGHT) that fell in the window
  // between the two walks, carrying that group's headcount on that date.
  sessionsGrazed: { headcount: number }[];
}): number | null {
  if (days <= 0 || sizeHa <= 0) return null;
  const removedTotal = sessionsGrazed.reduce((sum, s) => sum + s.headcount * INTAKE_PER_SESSION, 0);
  const removedPerHa = removedTotal / sizeHa;
  return (coverNow - coverPrevious + removedPerHa) / days;
}
