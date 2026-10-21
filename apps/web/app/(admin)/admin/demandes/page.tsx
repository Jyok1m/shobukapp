import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { joinRequestFilters, joinRequestsPath, parseJoinRequestFilter } from "@/components/admin/onboarding/join-request-filters";
import { JoinRequestList } from "@/components/admin/onboarding/join-request-list";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import { cx } from "@/lib/cx";
import { requireUser } from "@/lib/session";
import type { JoinRequestsPage } from "@/lib/types";

export const metadata: Metadata = { title: "Demandes" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/* The layout redirect does not protect the page: it checks the role itself. */
async function Requests({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("ADMIN");
  const filter = parseJoinRequestFilter((await searchParams).statut);
  const page = await apiGet<JoinRequestsPage>(joinRequestsPath(filter.status));
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <nav aria-label="Filtrer les demandes">
        <ul className="flex flex-wrap gap-2">
          {joinRequestFilters.map((item) => {
            const current = item.value === filter.value;
            return (
              <li key={item.label}>
                <Link
                  href={item.value ? `/admin/demandes?statut=${item.value}` : "/admin/demandes"}
                  aria-current={current ? "page" : undefined}
                  className={cx(
                    "inline-flex min-h-10 sm:min-h-8 items-center rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    current ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink hover:bg-paper",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <JoinRequestList key={filter.label} initial={page} status={filter.status} />
    </div>
  );
}

export default function AdminJoinRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Demandes"
        description="Les messages envoyés depuis « Nous rejoindre ». Répondez, puis envoyez un lien d'inscription."
      />
      <Suspense fallback={<PageFallback />}>
        <Requests searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
