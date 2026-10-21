import Link from "next/link";
import { cx } from "@/lib/cx";
import { membersSearch, membershipFilters, type MemberQuery } from "./query";

export function StatusFilters({ action, query }: { action: string; query: MemberQuery }) {
  return (
    <nav aria-label="Filtrer par situation de paiement">
      <ul className="flex flex-wrap gap-2">
        {membershipFilters.map((filter) => {
          const current = filter.value === query.status;
          return (
            <li key={filter.label}>
              <Link
                href={`${action}${membersSearch({ q: query.q, status: filter.value })}`}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-10 sm:min-h-8 items-center rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  current ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink hover:bg-paper",
                )}
              >
                {filter.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
