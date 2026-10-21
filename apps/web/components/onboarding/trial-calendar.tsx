"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "@/lib/cx";
import { MAX_TRIAL_DATES } from "@/lib/dojo";
import {
  addDays,
  dateToYmd,
  formatTrialDay,
  formatTrialDayLong,
  isTrialDateSelectable,
  trialWindow,
  weekdayOf,
  ymdToDate,
} from "@/lib/trial";

type Month = { year: number; month: number };

const monthTitle = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", month: "long", year: "numeric" });
const weekdayShort = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short" });
const weekdayLong = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long" });
// 2024-01-01 was a Monday: the week starts on Monday.
const WEEKDAYS = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(Date.UTC(2024, 0, 1 + index));
  return { short: weekdayShort.format(date), long: weekdayLong.format(date) };
});

function monthOf(ymd: string): Month {
  const date = ymdToDate(ymd);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

function monthKey({ year, month }: Month): number {
  return year * 12 + month;
}

function shiftMonth({ year, month }: Month, delta: number): Month {
  const date = new Date(Date.UTC(year, month + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

/* Weeks of the month, Monday first, null for the padding cells. */
function weeksOf({ year, month }: Month): (string | null)[][] {
  const first = dateToYmd(new Date(Date.UTC(year, month, 1)));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (weekdayOf(first) + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 0; day < days; day++) cells.push(addDays(first, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/*
 * Month grid of the evenings a visitor can offer for a trial class. Only the
 * opening days within the window are selectable; one tab stop on the grid,
 * arrow keys between days, Enter or Space to toggle.
 */
export function TrialCalendar({
  value,
  onChange,
  describedBy,
}: {
  value: string[];
  onChange: (dates: string[]) => void;
  describedBy?: string;
}) {
  // Read once when the calendar opens: the window does not move while the visitor picks.
  const [now] = useState(() => Date.now());
  const range = trialWindow(now);
  const firstSelectable = (() => {
    let day = range.first;
    while (day <= range.last && !isTrialDateSelectable(day, now)) day = addDays(day, 1);
    return day;
  })();
  const [visible, setVisible] = useState<Month>(() => monthOf(firstSelectable));
  const [focused, setFocused] = useState(firstSelectable);
  const [limitHit, setLimitHit] = useState(false);
  const grid = useRef<HTMLTableElement>(null);
  // Set by the arrow keys: move the DOM focus once the target day is rendered.
  const focusRequested = useRef(false);

  useLayoutEffect(() => {
    if (!focusRequested.current) return;
    focusRequested.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus();
  }, [focused, visible]);

  const minMonth = monthOf(range.first);
  const maxMonth = monthOf(range.last);
  const canPrev = monthKey(visible) > monthKey(minMonth);
  const canNext = monthKey(visible) < monthKey(maxMonth);
  const weeks = weeksOf(visible);
  // The roving tab stop stays inside the visible month.
  const tabStop = monthKey(monthOf(focused)) === monthKey(visible) ? focused : weeks.flat().find((day) => day !== null)!;

  function toggle(ymd: string) {
    if (!isTrialDateSelectable(ymd, now)) return;
    setFocused(ymd);
    if (value.includes(ymd)) {
      setLimitHit(false);
      return onChange(value.filter((day) => day !== ymd));
    }
    if (value.length >= MAX_TRIAL_DATES) return setLimitHit(true);
    setLimitHit(false);
    onChange([...value, ymd].sort());
  }

  function moveFocus(ymd: string) {
    if (ymd < range.first || ymd > range.last) return;
    focusRequested.current = true;
    setFocused(ymd);
    setVisible(monthOf(ymd));
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, ymd: string) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    moveFocus(addDays(ymd, moves[event.key]));
  }

  function changeMonth(delta: number) {
    const next = shiftMonth(visible, delta);
    setVisible(next);
    const firstOfMonth = dateToYmd(new Date(Date.UTC(next.year, next.month, 1)));
    setFocused(firstOfMonth < range.first ? range.first : firstOfMonth > range.last ? range.last : firstOfMonth);
  }

  const title = monthTitle.format(new Date(Date.UTC(visible.year, visible.month, 1)));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-line bg-paper p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <MonthButton direction="previous" disabled={!canPrev} onClick={() => changeMonth(-1)} />
          <p id="trial-month" aria-live="polite" className="font-serif text-base font-semibold text-ink first-letter:uppercase">
            {title}
          </p>
          <MonthButton direction="next" disabled={!canNext} onClick={() => changeMonth(1)} />
        </div>
        <table ref={grid} aria-labelledby="trial-month" aria-describedby={describedBy} className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              {WEEKDAYS.map((day) => (
                <th key={day.long} scope="col" abbr={day.long} className="pb-2 text-center text-xs font-medium text-muted">
                  {day.short.replace(".", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.find(Boolean)}>
                {week.map((ymd, index) => (
                  <td key={ymd ?? `pad-${index}`} className="p-0.5 text-center">
                    {ymd && (
                      <DayButton
                        ymd={ymd}
                        selectable={isTrialDateSelectable(ymd, now)}
                        selected={value.includes(ymd)}
                        tabbable={ymd === tabStop}
                        onToggle={toggle}
                        onKeyDown={onKeyDown}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {limitHit && (
        <p role="status" className="text-xs font-medium text-warning">
          {MAX_TRIAL_DATES} soirs au maximum : retirez-en un pour en choisir un autre.
        </p>
      )}
      {value.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink">
            {value.length > 1 ? `Soirs choisis (${value.length})` : "Soir choisi"}
          </p>
          <ul className="flex flex-wrap gap-2">
            {value.map((ymd) => (
              <li key={ymd}>
                <span className="inline-flex min-h-11 items-center gap-1 rounded-full border border-accent/30 bg-accent-soft py-1 pr-1 pl-3 text-sm text-ink sm:min-h-9">
                  {formatTrialDay(ymd)}
                  <button
                    type="button"
                    onClick={() => {
                      setLimitHit(false);
                      onChange(value.filter((day) => day !== ymd));
                    }}
                    aria-label={`Retirer ${formatTrialDay(ymd)}`}
                    title="Retirer"
                    className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent sm:size-7"
                  >
                    <svg viewBox="0 0 16 16" aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MonthButton({ direction, disabled, onClick }: { direction: "previous" | "next"; disabled: boolean; onClick: () => void }) {
  const label = direction === "previous" ? "Mois précédent" : "Mois suivant";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex size-11 items-center justify-center rounded-md text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-accent disabled:text-muted disabled:opacity-40 disabled:hover:bg-transparent sm:size-9"
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d={direction === "previous" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"} />
      </svg>
    </button>
  );
}

function DayButton({
  ymd,
  selectable,
  selected,
  tabbable,
  onToggle,
  onKeyDown,
}: {
  ymd: string;
  selectable: boolean;
  selected: boolean;
  tabbable: boolean;
  onToggle: (ymd: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, ymd: string) => void;
}) {
  return (
    <button
      type="button"
      data-day={ymd}
      tabIndex={tabbable ? 0 : -1}
      aria-pressed={selectable ? selected : undefined}
      aria-disabled={selectable ? undefined : true}
      aria-label={`${formatTrialDayLong(ymd)}${selectable ? "" : ", indisponible"}`}
      onClick={() => onToggle(ymd)}
      onKeyDown={(event) => onKeyDown(event, ymd)}
      className={cx(
        "mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-md text-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
        selected
          ? "bg-accent font-semibold text-on-accent hover:bg-accent-strong"
          : selectable
            ? "border border-field bg-surface font-medium text-ink hover:border-accent hover:bg-accent-soft"
            : "text-muted/60",
      )}
    >
      {ymdToDate(ymd).getUTCDate()}
    </button>
  );
}
