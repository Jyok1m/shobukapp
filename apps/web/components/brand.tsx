import Link from "next/link";
import { Logo } from "@/components/logo";
import { cx } from "@/lib/cx";

/* `collapse`: logo only below `sm`, the name stays for screen readers. */
export function Brand({
  href = "/",
  className,
  collapse = false,
}: {
  href?: string;
  className?: string;
  collapse?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx("inline-flex items-center gap-2 font-serif text-lg font-bold text-ink", className)}
    >
      <Logo className="h-7 w-auto text-ink" />
      <span className={collapse ? "sr-only sm:not-sr-only" : undefined}>Shobukan Dojo</span>
    </Link>
  );
}
