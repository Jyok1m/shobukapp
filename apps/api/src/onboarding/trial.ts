import { BadRequestException } from '@nestjs/common';

// The dojo is open on Monday, Wednesday and Friday evenings (getUTCDay values).
export const OPEN_DAYS = [1, 3, 5];
export const TRIAL_HORIZON_DAYS = 60;
export const MAX_TRIAL_DATES = 6;
const TIME_ZONE = 'Europe/Paris';

function parisDay(date: Date): { ymd: string; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: days.indexOf(get('weekday') ?? ''),
  };
}

/*
 * Dates a visitor offers for a trial class: calendar days (YYYY-MM-DD), on an
 * opening day, from tomorrow (Paris time) up to the horizon, no duplicates.
 */
export function validateTrialDates(dates: string[]): Date[] {
  const today = parisDay(new Date()).ymd;
  const horizon = new Date(Date.now() + TRIAL_HORIZON_DAYS * 24 * 3600 * 1000);
  const unique = [...new Set(dates)].sort();
  if (unique.length !== dates.length || unique.length > MAX_TRIAL_DATES) {
    throw new BadRequestException({ code: 'invalid_trial_dates' });
  }
  return unique.map((ymd) => {
    // A calendar day: midnight UTC keeps the same Y-M-D and weekday.
    const date = new Date(`${ymd}T00:00:00Z`);
    if (
      Number.isNaN(date.getTime()) ||
      ymd <= today ||
      date > horizon ||
      !OPEN_DAYS.includes(date.getUTCDay())
    ) {
      throw new BadRequestException({ code: 'invalid_trial_dates' });
    }
    return date;
  });
}

// The slot an admin confirms: in the future, on an opening day in Paris.
export function validateTrialSlot(iso: string): Date {
  const slot = new Date(iso);
  if (
    Number.isNaN(slot.getTime()) ||
    slot.getTime() <= Date.now() ||
    !OPEN_DAYS.includes(parisDay(slot).weekday)
  ) {
    throw new BadRequestException({ code: 'invalid_trial_slot' });
  }
  return slot;
}

export function formatTrialSlot(slot: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(slot);
}

export function formatTrialDay(day: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(day);
}
