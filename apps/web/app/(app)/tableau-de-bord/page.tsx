import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, cache, type ReactNode } from "react";
import { DocumentBoardSections } from "@/components/documents/document-board";
import { MembershipBadge } from "@/components/membership-badge";
import { PortalButton } from "@/components/billing/portal-button";
import { NotCarriedNotice } from "@/components/billing/test-mode-notices";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { apiGet } from "@/lib/api";
import { cotisationLabel, formatDate, profileCompleteness } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { DocumentBoard, Membership } from "@/lib/types";

export const metadata: Metadata = { title: "Tableau de bord" };

/* Read once per request by the notice and the card. */
const getMembership = cache(() => apiGet<Membership>("/billing/subscription"));

function LinkCard({ href, title, children }: { href: string; title: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Card title={title} className="h-full transition-colors hover:border-accent/40">
        {children}
      </Card>
    </Link>
  );
}

function CardFallback({ title }: { title: string }) {
  return (
    <Card title={title} className="h-full" aria-busy>
      <p className="text-sm text-muted">Chargement…</p>
    </Card>
  );
}

async function Greeting() {
  const user = await requireUser();
  return (
    <PageHeader
      title={`Bonjour ${user.firstName}`}
      description="Bienvenue dans votre espace membre du Shobukan Dojo."
    />
  );
}

async function MembershipSummary() {
  await requireUser();
  const membership = await getMembership();
  /* Not a LinkCard: the portal button cannot sit inside a link. */
  return (
    <Card title="Ma cotisation" className="h-full">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MembershipBadge status={membership.status} />
          {membership.testMode && <Badge tone="warning">Démonstration</Badge>}
          {membership.planName && (
            <span className="text-sm text-ink">{cotisationLabel(membership.planName, membership.frequency)}</span>
          )}
        </div>
        <p className="text-sm text-muted">
          {membership.isMember && membership.currentPeriodEnd
            ? `${membership.cancelAtPeriodEnd ? "Se termine le" : "Renouvellement le"} ${formatDate(membership.currentPeriodEnd)}.`
            : membership.isMember
              ? "Votre adhésion est à jour."
              : "Adhérez au dojo et réglez votre cotisation en ligne."}
        </p>
        {(membership.status === "past_due" || membership.status === "unpaid") && (
          <p className="text-sm text-danger">
            Votre dernier paiement n&apos;a pas abouti. Mettez à jour votre moyen de paiement.
          </p>
        )}
        <Link href="/cotisation" className="inline-flex min-h-11 items-center self-start text-sm font-medium text-accent hover:underline sm:min-h-0">
          Voir ma cotisation
        </Link>
        {membership.manageable && (
          <PortalButton variant="secondary" label="Gérer mon compte de paiement" testMode={membership.testMode} className="mt-2" />
        )}
      </div>
    </Card>
  );
}

async function CarriedOver() {
  await requireUser();
  const membership = await getMembership();
  return membership.testCotisationNotCarried ? <NotCarriedNotice className="mb-6" /> : null;
}

async function Board() {
  await requireUser();
  const board = await apiGet<DocumentBoard>("/documents/board");
  return <DocumentBoardSections board={board} />;
}

async function ProfileSummary() {
  const user = await requireUser();
  const { filled, total } = profileCompleteness(user);
  const complete = filled === total;
  return (
    <LinkCard href="/profil" title="Mon profil">
      <div className="flex flex-col gap-2">
        <div
          role="progressbar"
          aria-label="Profil complété"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={filled}
          className="h-2 overflow-hidden rounded-full bg-ink/5"
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((filled / total) * 100)}%` }} />
        </div>
        <p className="text-sm text-muted">
          {complete
            ? "Votre profil est complet."
            : `${filled} informations sur ${total} renseignées. Complétez votre profil pour votre licence FFJDA.`}
        </p>
      </div>
    </LinkCard>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col">
      <Suspense fallback={<PageHeader title="Bonjour" />}>
        <Greeting />
      </Suspense>
      <Suspense fallback={null}>
        <CarriedOver />
      </Suspense>
      <div className="grid gap-4 md:grid-cols-3">
        <Suspense fallback={<CardFallback title="Ma cotisation" />}>
          <MembershipSummary />
        </Suspense>
        <Suspense fallback={<CardFallback title="Mon profil" />}>
          <ProfileSummary />
        </Suspense>
        <LinkCard href="/documents" title="Déposer mon certificat médical">
          <p className="text-sm text-muted">Indispensable pour pratiquer.</p>
        </LinkCard>
      </div>
      <div className="mt-10 flex flex-col gap-10">
        <Suspense fallback={null}>
          <Board />
        </Suspense>
      </div>
    </div>
  );
}
