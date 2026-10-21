import Link from "next/link";
import { Logo } from "@/components/logo";
import { cx } from "@/lib/cx";

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cx("inline-flex items-center gap-2 font-serif text-lg font-bold text-ink", className)}
    >
      <Logo className="h-7 w-auto text-ink" />
      Shobukan Dojo
    </Link>
  );
}
