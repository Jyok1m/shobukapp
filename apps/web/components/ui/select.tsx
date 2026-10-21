import type { SelectHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "h-10 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent/30 aria-invalid:border-danger sm:text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
