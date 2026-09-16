// Feed-efficiency figure, computed on read (never stored): grams of
// concentrate fed per litre of milk produced, per cow per day.
export function gramsPerLitre(kgPerCow: number | null | undefined, litresPerCow: number | null | undefined): number | null {
  if (kgPerCow == null || litresPerCow == null || litresPerCow <= 0) return null;
  return Math.round((kgPerCow * 1000) / litresPerCow);
}
