// FFJDA seasons run September to August: "2026-2027" from 1 September 2026.
export function currentSeason(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const start = month >= 9 ? year : year - 1;
  return `${start}-${start + 1}`;
}
