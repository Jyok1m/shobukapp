import type { Metadata } from "next";
import { Suspense } from "react";
import { MemberSearch } from "@/components/admin/members/member-search";
import { MembersTable } from "@/components/admin/members/members-table";
import { membersSearch, parseMemberQuery } from "@/components/admin/members/query";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { buttonClasses } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";
import type { AdminMembersPage } from "@/lib/types";

export const metadata: Metadata = { title: "Membres" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/* The layout redirect does not protect the page: it checks the role itself. */
async function Members({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("ADMIN");
  // This page has no payment filter: only the search is kept.
  const query = { ...parseMemberQuery(await searchParams), status: null };
  const page = await apiGet<AdminMembersPage>(`/admin/members${membersSearch(query)}`);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          L&apos;export est journalisé (qui, quand). Il ne contient jamais les mots de passe ni les documents médicaux.
        </p>
        {/* Same-origin link: the session cookie goes with it and the API answers with an attachment. */}
        <a href="/api/admin/members/export" download className={buttonClasses("secondary", "md", "shrink-0")}>
          Exporter (CSV)
        </a>
      </div>
      <MemberSearch action="/admin/membres" query={query} />
      <MembersTable key={query.q} initial={page} query={query} />
    </div>
  );
}

export default function AdminMembersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex flex-col">
      <PageHeader title="Membres" description="Tous les comptes du dojo, leurs coordonnées et leur fiche." />
      <Suspense fallback={<PageFallback />}>
        <Members searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
