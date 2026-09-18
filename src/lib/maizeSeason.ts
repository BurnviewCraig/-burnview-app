// SA maize runs roughly Oct-plant to Apr/Jul-harvest, so a date's "season"
// straddles a calendar year boundary. Anything from July onward belongs to
// the season starting that year; anything before July belongs to the
// season that started the previous year.
export function maizeSeasonFor(date: Date | string): string {
  const d = new Date(date);
  const year = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}
