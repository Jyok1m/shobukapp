import { cx } from "@/lib/cx";
import { DOJO } from "@/lib/dojo";

/* Postal address, phone and e-mail of the dojo, as real links on mobile (tel:, mailto:). */
export function DojoContact({ className, compact = false }: { className?: string; compact?: boolean }) {
  const link = "inline-flex min-h-10 items-center underline-offset-2 hover:text-ink hover:underline sm:min-h-0";
  return (
    <address className={cx("flex flex-col gap-1 not-italic", className)}>
      {!compact && <span className="font-medium text-ink">{DOJO.name}</span>}
      <span>
        {DOJO.street}, {DOJO.city}
        {!compact && `, ${DOJO.country}`}
      </span>
      <a href={DOJO.phoneHref} className={link}>
        {DOJO.phone}
      </a>
      <a href={`mailto:${DOJO.email}`} className={cx(link, "break-all")}>
        {DOJO.email}
      </a>
    </address>
  );
}
