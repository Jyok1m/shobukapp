import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type NoticeTone = "info" | "success" | "danger";

const tones: Record<NoticeTone, string> = {
  info: "border-line bg-paper text-ink",
  success: "border-success/20 bg-success-soft text-success",
  danger: "border-danger/20 bg-danger-soft text-danger",
};

/* Inline message. Errors are announced as alerts, the rest politely. */
export function Notice({
  tone = "info",
  className,
  children,
}: {
  tone?: NoticeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx("rounded-md border px-3 py-2 text-sm", tones[tone], className)}
    >
      {children}
    </div>
  );
}
