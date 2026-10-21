import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  title?: ReactNode;
  description?: ReactNode;
};

export function Card({ title, description, className, children, ...props }: CardProps) {
  return (
    <div
      className={cx("rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6", className)}
      {...props}
    >
      {(title || description) && (
        <div className="mb-4 flex flex-col gap-1">
          {title && <h2 className="font-serif text-lg font-semibold text-ink">{title}</h2>}
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
