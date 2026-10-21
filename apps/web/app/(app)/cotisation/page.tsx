import type { Metadata } from "next";
import { Suspense } from "react";
import { PageFallback } from "@/components/page-fallback";
import { PageHeader } from "@/components/page-header";
import { MembershipBadge } from "@/components/membership-badge";
import { PaymentReturnNotice } from "@/components/billing/payment-return-notice";
import { PaymentsTable } from "@/components/billing/payments-table";
import { PlanCard, PlanGrid, PriceList } from "@/components/billing/plan-card";
import { FrequencyChange } from "@/components/billing/frequency-change";
import { PlanCheckout } from "@/components/billing/plan-checkout";
import { DemoPaymentNotice, NotCarriedNotice } from "@/components/billing/test-mode-notices";
import { PortalButton } from "@/components/billing/portal-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { apiGet } from "@/lib/api";
import { cotisationLabel, formatDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import type { Membership, PublicPlan } from "@/lib/types";

export const metadata: Metadata = { title: "Ma cotisation" };

// A subscription in these states still exists at Stripe: checkout answers already_subscribed.
const OUTSTANDING = ["past_due", "unpaid"];

function MembershipCard({ membership, plan }: { membership: Membership; plan: PublicPlan | undefined }) {
  const { status, isMember, planName, frequency, currentPeriodEnd, cancelAtPeriodEnd, manageable } = membership;
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-serif text-lg font-semibold text-ink">{cotisationLabel(planName, frequency) ?? "Aucune formule"}</h2>
            <MembershipBadge status={status} />
            {membership.testMode && <Badge tone="warning">Démonstration</Badge>}
          </div>
          {isMember && currentPeriodEnd && (
            <p className="text-sm text-muted">
              {cancelAtPeriodEnd ? "Fin de la cotisation le " : "Prochain renouvellement le "}
              <span className="font-medium text-ink">{formatDate(currentPeriodEnd)}</span>
            </p>
          )}
          {membership.testMode && isMember && (
            <p className="text-sm text-warning">
              Cotisation de démonstration : elle ne sera pas reprise quand le dojo passera aux paiements réels.
            </p>
          )}
          {!isMember && !status && (
            <p className="text-sm text-muted">Choisissez une formule ci-dessous pour adhérer au dojo.</p>
          )}
          {status && OUTSTANDING.includes(status) && (
            <p className="text-sm text-danger">
              Votre dernier paiement n&apos;a pas abouti. Mettez à jour votre moyen de paiement pour conserver
              votre adhésion.
            </p>
          )}
        </div>
        {manageable && <PortalButton variant={isMember ? "secondary" : "primary"} />}
      </div>
      {/* Only an active cotisation of the current mode can change frequency (docs/billing.md). */}
      {plan && frequency && (status === "active" || status === "trialing") && !cancelAtPeriodEnd && (
        <div className="mt-4">
          <FrequencyChange current={frequency} prices={plan.prices} currency={plan.currency} />
        </div>
      )}
      {isMember && cancelAtPeriodEnd && (
        <Notice className="mt-4">
          Votre cotisation a été résiliée et ne sera pas renouvelée. Vous restez membre jusqu&apos;à la fin de la
          période en cours.
        </Notice>
      )}
    </Card>
  );
}

function Plans({ plans }: { plans: PublicPlan[] }) {
  if (plans.length === 0) {
    return (
      <EmptyState
        title="Aucune formule disponible"
        description="Le dojo n'a pas encore publié ses formules. Revenez bientôt ou contactez un responsable."
      />
    );
  }
  const purchasable = plans.some((plan) => plan.prices.some((price) => price.purchasable));
  return (
    <div className="flex flex-col gap-4">
      {!purchasable && (
        <Notice>Le paiement en ligne n&apos;est pas encore ouvert. Contactez un responsable du dojo pour adhérer.</Notice>
      )}
      <PlanGrid>
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan}>
            {purchasable ? <PlanCheckout plan={plan} /> : <PriceList plan={plan} />}
          </PlanCard>
        ))}
      </PlanGrid>
    </div>
  );
}

async function Subscription() {
  await requireUser();
  const [membership, plans] = await Promise.all([
    apiGet<Membership>("/billing/subscription"),
    apiGet<PublicPlan[]>("/billing/plans"),
  ]);
  const canSubscribe = !membership.isMember && !OUTSTANDING.includes(membership.status ?? "");

  return (
    <div className="flex flex-col gap-8">
      {membership.testCotisationNotCarried && <NotCarriedNotice />}
      <PaymentReturnNotice isMember={membership.isMember} />
      <MembershipCard membership={membership} plan={plans.find((plan) => plan.id === membership.planId)} />
      {canSubscribe && (
        <section className="flex flex-col gap-4" aria-labelledby="plans-title">
          <h2 id="plans-title" className="font-serif text-xl font-semibold text-ink">
            Nos formules
          </h2>
          {membership.testMode && <DemoPaymentNotice />}
          <Plans plans={plans} />
        </section>
      )}
      <section className="flex flex-col gap-4" aria-labelledby="payments-title">
        <h2 id="payments-title" className="font-serif text-xl font-semibold text-ink">
          Historique des paiements
        </h2>
        <PaymentsTable payments={membership.payments} />
      </section>
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Ma cotisation" description="Votre adhésion au dojo, vos paiements et vos factures." />
      <Suspense fallback={<PageFallback />}>
        <Subscription />
      </Suspense>
    </div>
  );
}
