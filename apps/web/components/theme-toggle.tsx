"use client";

import { cx } from "@/lib/cx";
import { setTheme, useResolvedTheme } from "@/lib/theme";

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-5">
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden className="size-5">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </svg>
  );
}

/*
 * One button: a moon in light mode, a sun in dark mode. Until the user clicks,
 * the page follows the system preference (no stored choice).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const resolved = useResolvedTheme();
  // Unknown until hydration: a neutral name rather than a possibly wrong action.
  const label =
    resolved === null ? "Changer de thème" : resolved === "dark" ? "Activer le thème clair" : "Activer le thème sombre";
  return (
    <button
      type="button"
      onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:size-9",
        className,
      )}
    >
      {resolved === "dark" ? <SunIcon /> : resolved === "light" ? <MoonIcon /> : <span className="size-5" />}
    </button>
  );
}
