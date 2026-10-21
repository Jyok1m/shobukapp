import type { ReactNode } from "react";

/* Unchecked by default: consent must be an explicit act. */
export function ConsentCheckbox({ id, error, children }: { id: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        <input
          id={id}
          name={id}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <label htmlFor={id} className="text-sm text-ink">
          {children}
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
