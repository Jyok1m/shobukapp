import Link from "next/link";
import { cx } from "@/lib/cx";

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cx("inline-flex items-center gap-2 font-serif text-lg font-bold text-ink", className)}
    >
      <span aria-hidden className="size-2.5 rounded-full bg-accent" />
      Shobukan Dojo
    </Link>
  );
}
