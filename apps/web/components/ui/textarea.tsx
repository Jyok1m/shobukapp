import type { TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "min-h-20 w-full rounded-md border border-field bg-surface px-3 py-2 text-base text-ink placeholder:text-muted/70 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent/30 aria-invalid:border-danger sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}
