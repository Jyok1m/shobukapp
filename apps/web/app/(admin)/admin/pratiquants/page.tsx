import type { Metadata } from "next";
import { Suspense } from "react";
import { MemberSearch } from "@/components/admin/members/member-search";
import { PayersTable } from "@/components/admin/members/payers-table";
import { membersSearch, parseMemberQuery } from "@/components/admin/members/query";
import { StatusFilters } from "@/components/admin/members/status-filters";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";
import type { AdminMembersPage } from "@/lib/types";

export const metadata: Metadata = { title: "Pratiquants" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const path = "/admin/pratiquants";

/* The layout redirect does not protect the page: it checks the role itself. */
async function Payers({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("ADMIN");
  const query = parseMemberQuery(await searchParams);
  const page = await apiGet<AdminMembersPage>(`/admin/members${membersSearch(query)}`);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <StatusFilters action={path} query={query} />
        <MemberSearch action={path} query={query} />
      </div>
      {/* Keyed on the query so "Charger plus" restarts from the new first page. */}
      <PayersTable key={`${query.status ?? ""}|${query.q}`} initial={page} query={query} />
    </div>
  );
}

export default function AdminPayersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Pratiquants"
        description="Qui est à jour de sa cotisation, qui ne l'est pas, et les relances envoyées."
      />
      <Suspense fallback={<PageFallback />}>
        <Payers searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
