import { OPEN_DAYS, TRIAL_HORIZON_DAYS } from "./dojo";

/*
 * Calendar days are 'YYYY-MM-DD' strings, handled as midnight UTC so the day
 * and weekday never shift with the browser's time zone. The dojo's clock is
 * Europe/Paris.
 */
const TIME_ZONE = "Europe/Paris";
const DAY_MS = 24 * 3600 * 1000;

export function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

export function dateToYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  return dateToYmd(new Date(ymdToDate(ymd).getTime() + days * DAY_MS));
}

export function weekdayOf(ymd: string): number {
  return ymdToDate(ymd).getUTCDay();
}

export function isOpenDay(ymd: string): boolean {
  return OPEN_DAYS.includes(weekdayOf(ymd));
}

/* Today's calendar day in Paris. */
/* Built from parts, not from a locale's format() string, which browsers have changed before. */
export function parisToday(now: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/* Same rule as the API: an opening day, after today in Paris, within the horizon. */
export function isTrialDateSelectable(ymd: string, now: number): boolean {
  return isOpenDay(ymd) && ymd > parisToday(now) && ymdToDate(ymd).getTime() <= now + TRIAL_HORIZON_DAYS * DAY_MS;
}

/* First and last days the visitor may pick (not necessarily opening days). */
export function trialWindow(now: number): { first: string; last: string } {
  const first = addDays(parisToday(now), 1);
  let last = addDays(parisToday(now), TRIAL_HORIZON_DAYS);
  while (last > first && ymdToDate(last).getTime() > now + TRIAL_HORIZON_DAYS * DAY_MS) last = addDays(last, -1);
  return { first, last };
}

/* "lundi 3 novembre" */
export function formatTrialDay(ymd: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    ymdToDate(ymd),
  );
}

/* "lundi 3 novembre 2026", for screen readers in the calendar. */
export function formatTrialDayLong(ymd: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(ymdToDate(ymd));
}

/* Wall clock of an instant in Paris, as UTC milliseconds. */
function parisWallTime(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

/*
 * ISO 8601 with the Paris offset for a wall time on that day:
 * ('2026-11-04', '19:30') gives '2026-11-04T19:30:00+01:00', a July date '+02:00'.
 * The offset is read at the resulting instant, so it is right on either side of a DST change.
 */
export function parisIso(ymd: string, time: string): string {
  const wall = Date.parse(`${ymd}T${time}:00Z`);
  let offset = parisWallTime(wall) - wall;
  offset = parisWallTime(wall - offset) - (wall - offset);
  const minutes = Math.round(offset / 60000);
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${ymd}T${time}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/* "mercredi 5 novembre à 19:30" */
export function formatTrialSlot(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" }).format(date);
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day} à ${time}`;
}

/* "5 nov. 19:30", for list badges. */
export function formatTrialSlotShort(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, day: "numeric", month: "short" }).format(date);
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day} ${time}`;
}

/* Paris calendar day of a stored instant, 'YYYY-MM-DD'. */
export function parisYmd(iso: string): string {
  return parisToday(new Date(iso).getTime());
}

/* Paris wall time of a stored instant, 'HH:MM'. */
export function parisTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(iso),
  );
}
