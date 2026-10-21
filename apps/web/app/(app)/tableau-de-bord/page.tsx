import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { MembershipBadge } from "@/components/membership-badge";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { apiGet } from "@/lib/api";
import { formatDate, profileCompleteness } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { Membership } from "@/lib/types";

export const metadata: Metadata = { title: "Tableau de bord" };

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
  const membership = await apiGet<Membership>("/billing/subscription");
  return (
    <LinkCard href="/cotisation" title="Ma cotisation">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MembershipBadge status={membership.status} />
          {membership.planName && <span className="text-sm text-ink">{membership.planName}</span>}
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
      </div>
    </LinkCard>
  );
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
            : `${filled} informations sur ${total} renseignées. Complétez votre profil pour votre licence FFK.`}
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
    </div>
  );
}
