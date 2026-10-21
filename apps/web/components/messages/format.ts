const time = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", timeZone: "Europe/Paris" });
const dayMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
const full = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });

/* Hour for today, day and month before. */
export function formatListDate(value: string): string {
  const date = new Date(value);
  return dayKey.format(date) === dayKey.format(new Date()) ? time.format(date) : dayMonth.format(date);
}

export function formatMessageDate(value: string): string {
  return full.format(new Date(value));
}

export function photoUrl(counterpart: { id: string; hasPhoto: boolean }): string | null {
  return counterpart.hasPhoto ? `/api/members/${counterpart.id}/photo` : null;
}
