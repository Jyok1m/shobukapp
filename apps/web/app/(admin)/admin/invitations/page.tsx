import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CodeInvitationForm } from "@/components/admin/onboarding/code-invitation-form";
import { InvitationsTable } from "@/components/admin/onboarding/invitations-table";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";
import type { Invitation } from "@/lib/types";

export const metadata: Metadata = { title: "Invitations" };

/* The layout redirect does not protect the page: it checks the role itself. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = Promise<{ apres?: string | string[] }>;

async function Invitations({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("ADMIN");
  const { apres } = await searchParams;
  const cursor = typeof apres === "string" && UUID.test(apres) ? apres : null;
  const { items: invitations, nextCursor } = await apiGet<{ items: Invitation[]; nextCursor: string | null }>(
    cursor ? `/admin/invitations?cursor=${cursor}` : "/admin/invitations",
  );
  return (
    <div className="flex flex-col gap-8">
      <div className="max-w-3xl">
        <CodeInvitationForm />
      </div>
      <section className="flex flex-col gap-4" aria-labelledby="invitations-title">
        <h2 id="invitations-title" className="font-serif text-xl font-semibold text-ink">
          Invitations envoyées
        </h2>
        <InvitationsTable invitations={invitations} />
        <div className="flex flex-wrap gap-4 text-sm">
          {cursor && (
            <Link href="/admin/invitations" className="text-accent hover:underline">
              Revenir aux plus récentes
            </Link>
          )}
          {nextCursor && (
            <Link href={`/admin/invitations?apres=${nextCursor}`} className="text-accent hover:underline">
              Voir les invitations plus anciennes
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

export default function AdminInvitationsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Invitations"
        description="Liens d'inscription et codes d'activation. Chaque invitation est valable 14 jours."
      />
      <Suspense fallback={<PageFallback />}>
        <Invitations searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
