import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <p className="font-serif text-lg font-semibold text-ink">{title}</p>
      {description && <p className="max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
