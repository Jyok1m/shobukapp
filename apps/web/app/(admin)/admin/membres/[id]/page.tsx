import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DeleteMemberZone } from "@/components/admin/members/delete-member-zone";
import { MemberLicences } from "@/components/admin/members/member-licences";
import { MemberReminders } from "@/components/admin/members/member-reminders";
import { fullName } from "@/components/admin/members/query";
import { SubscriptionsTable } from "@/components/admin/members/subscriptions-table";
import { DocumentList } from "@/components/documents/document-list";
import { PaymentsTable } from "@/components/billing/payments-table";
import { MembershipBadge } from "@/components/membership-badge";
import { PageFallback } from "@/components/page-fallback";
import { ProfileForm } from "@/components/profile/profile-form";
import { Badge } from "@/components/ui/badge";
import { apiFetch, apiGet } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { AdminMemberDetail, License, MemberDocument } from "@/lib/types";

export const metadata: Metadata = { title: "Fiche membre" };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadMember(id: string): Promise<AdminMemberDetail> {
  // The API answers 400 to a malformed id: treat it as an unknown member.
  if (!uuid.test(id)) notFound();
  const res = await apiFetch(`/admin/members/${id}`);
  if (res.status === 401) redirect("/connexion");
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`GET /admin/members/:id failed with status ${res.status}`);
  return (await res.json()) as AdminMemberDetail;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby={id}>
      <h2 id={id} className="font-serif text-xl font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

/* The layout redirect does not protect the page: it checks the role itself. */
async function MemberDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireUser("ADMIN");
  const { id } = await params;
  const member = await loadMember(id);
  const [documents, licenses] = await Promise.all([
    apiGet<MemberDocument[]>(`/admin/documents/members/${member.id}`),
    apiGet<License[]>(`/admin/licenses?userId=${member.id}`),
  ]);
  const name = fullName(member);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Link href="/admin/membres" className="text-sm font-medium text-accent hover:underline">
          Retour aux membres
        </Link>
        <h1 className="font-serif text-2xl font-bold text-ink sm:text-3xl">{name}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <a href={`mailto:${member.email}`} className="text-accent hover:underline">
            {member.email}
          </a>
          <span aria-hidden>·</span>
          <span>Inscrit le {formatDate(member.createdAt)}</span>
          <MembershipBadge status={member.membership.status} />
          {member.role === "ADMIN" && <Badge tone="accent">Admin</Badge>}
        </div>
      </div>

      <Section id="profile-title" title="Profil">
        <div className="max-w-3xl">
          <ProfileForm user={member} memberId={member.id} />
        </div>
      </Section>

      <Section id="subscriptions-title" title="Abonnements">
        <SubscriptionsTable subscriptions={member.subscriptions} />
      </Section>

      <Section id="payments-title" title="Paiements">
        <PaymentsTable
          payments={member.payments}
          emptyDescription="Aucun paiement n'a encore été enregistré pour ce membre."
        />
      </Section>

      <Section id="documents-title" title="Documents">
        <DocumentList
          documents={documents}
          caption={`Documents de ${name}`}
          emptyTitle="Aucun document"
          emptyDescription="Ce membre n'a encore déposé aucun document, ni certificat médical."
        />
      </Section>

      <div className="max-w-3xl">
        <MemberLicences memberId={member.id} licenses={licenses} />
      </div>

      <div className="max-w-3xl">
        <MemberReminders member={{ id: member.id, name }} reminders={member.remindersReceived} />
      </div>

      {admin.id !== member.id && (
        <div className="max-w-3xl">
          <DeleteMemberZone memberId={member.id} firstName={member.firstName} lastName={member.lastName} />
        </div>
      )}
    </div>
  );
}

export default function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <MemberDetail params={params} />
    </Suspense>
  );
}
