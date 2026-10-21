"use client";

import { cx } from "@/lib/cx";
import { setTheme, useTheme, type ThemeChoice } from "@/lib/theme";

const choices: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
  { value: "system", label: "Système" },
];

/*
 * Segmented radio group (one tab stop, arrow keys between choices), or a
 * compact select where space is short (public header on a phone).
 */
export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const current = useTheme();
  if (compact) {
    return (
      <label className={cx("relative inline-flex items-center", className)}>
        <span className="sr-only">Thème d&apos;affichage</span>
        <select
          value={current}
          onChange={(event) => setTheme(event.target.value as ThemeChoice)}
          className="min-h-10 rounded-md border border-line bg-surface px-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent sm:min-h-8"
        >
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <fieldset className={cx("flex flex-col gap-1.5", className)}>
      <legend className="sr-only">Thème d&apos;affichage</legend>
      <div className="grid grid-cols-3 rounded-md border border-line bg-paper p-0.5 text-xs">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className={cx(
              "flex min-h-10 items-center justify-center rounded px-2 font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-accent sm:min-h-8",
              current === choice.value ? "bg-surface text-ink shadow-xs" : "text-muted hover:text-ink",
            )}
          >
            <input
              type="radio"
              name="theme"
              value={choice.value}
              checked={current === choice.value}
              onChange={() => setTheme(choice.value)}
              className="sr-only"
            />
            {choice.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
