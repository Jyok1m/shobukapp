import type { ReactNode } from "react";
import { formatAmount, formatDate, frequencyUnits } from "@/lib/format";
import type { PublicPlan } from "@/lib/types";

/* Static list of the offered frequencies (public landing, no purchase there). */
export function PriceList({ plan }: { plan: PublicPlan }) {
  return (
    <ul className="flex flex-col gap-1">
      {plan.prices.map((price) => (
        <li key={price.frequency} className="flex items-baseline gap-2">
          <span className="text-xl font-semibold text-ink">{formatAmount(price.amountCents, plan.currency)}</span>
          <span className="text-sm text-muted">{frequencyUnits[price.frequency]}</span>
        </li>
      ))}
    </ul>
  );
}

/* The yearly entrance fee, or the date it is paid until (then nothing is due at checkout). */
function EntranceFee({ plan, paidUntil }: { plan: PublicPlan; paidUntil?: string | null }) {
  if (plan.entranceFeeCents <= 0) return null;
  // The API only returns a date still in the future.
  if (paidUntil) {
    return <p className="text-sm text-success">Droit d&apos;entrée réglé jusqu&apos;au {formatDate(paidUntil)}</p>;
  }
  return (
    <p className="text-sm text-ink">
      + droit d&apos;entrée annuel : <span className="font-medium">{formatAmount(plan.entranceFeeCents, plan.currency)}</span>
      <span className="block text-xs text-muted">Réglé avec le premier paiement, puis une fois par an.</span>
    </p>
  );
}

export function PlanCard({
  plan,
  entranceFeePaidUntil,
  children,
}: {
  plan: PublicPlan;
  /* GET /billing/subscription: a future date means no entrance fee at the next checkout. */
  entranceFeePaidUntil?: string | null;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="font-serif text-lg font-semibold text-ink">{plan.name}</h3>
        {plan.description && <p className="text-sm whitespace-pre-line text-muted">{plan.description}</p>}
        <EntranceFee plan={plan} paidUntil={entranceFeePaidUntil} />
      </div>
      <div className="mt-auto flex flex-col gap-4">{children}</div>
    </li>
  );
}

export function PlanGrid({ children }: { children: ReactNode }) {
  return <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>;
}
