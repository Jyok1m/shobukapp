import type { InputHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cx(
        "h-10 w-full rounded-md border border-line bg-surface px-3 text-base text-ink placeholder:text-muted/70 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent/30 aria-invalid:border-danger sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}
