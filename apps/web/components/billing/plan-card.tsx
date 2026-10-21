import type { ReactNode } from "react";
import { formatAmount, intervalLabels } from "@/lib/format";
import type { PublicPlan } from "@/lib/types";

export function PlanCard({ plan, action }: { plan: PublicPlan; action?: ReactNode }) {
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-1">
        <h3 className="font-serif text-lg font-semibold text-ink">{plan.name}</h3>
        <p className="text-2xl font-semibold text-ink">
          {formatAmount(plan.amountCents, plan.currency)}{" "}
          <span className="text-sm font-normal text-muted">{intervalLabels[plan.interval]}</span>
        </p>
      </div>
      {plan.description && <p className="text-sm whitespace-pre-line text-muted">{plan.description}</p>}
      {action && <div className="mt-auto pt-2">{action}</div>}
    </li>
  );
}

export function PlanGrid({ children }: { children: ReactNode }) {
  return <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>;
}
