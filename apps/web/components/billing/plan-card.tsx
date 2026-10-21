import type { ReactNode } from "react";
import { formatAmount, frequencyUnits } from "@/lib/format";
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

export function PlanCard({ plan, children }: { plan: PublicPlan; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="font-serif text-lg font-semibold text-ink">{plan.name}</h3>
        {plan.description && <p className="text-sm whitespace-pre-line text-muted">{plan.description}</p>}
      </div>
      <div className="mt-auto flex flex-col gap-4">{children}</div>
    </li>
  );
}

export function PlanGrid({ children }: { children: ReactNode }) {
  return <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>;
}
