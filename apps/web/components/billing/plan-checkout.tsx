"use client";

import { useId, useState } from "react";
import { cx } from "@/lib/cx";
import { formatAmount, frequencyNames, frequencyUnits, paymentsPerYear } from "@/lib/format";
import type { Frequency, PublicPlan } from "@/lib/types";
import { SubscribeButton } from "./subscribe-button";

/*
 * Native radios in a fieldset: arrow keys move between frequencies, the legend
 * names the group. The yearly one is preselected when offered.
 */
export function PlanCheckout({ plan }: { plan: PublicPlan }) {
  // The API never lists a plan without an offered frequency; guarded before any hook.
  if (plan.prices.length === 0) return null;
  return <FrequencyChoice plan={plan} />;
}

function FrequencyChoice({ plan }: { plan: PublicPlan }) {
  const name = useId();
  const initial = plan.prices.find((price) => price.frequency === "YEAR") ?? plan.prices[0];
  const [frequency, setFrequency] = useState<Frequency>(initial.frequency);
  const selected = plan.prices.find((price) => price.frequency === frequency) ?? initial;
  // The yearly equivalent only helps when there is something to compare.
  const compare = plan.prices.length > 1;

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-ink">Fréquence de paiement</legend>
        {plan.prices.map((price) => {
          const checked = price.frequency === frequency;
          const yearly = price.amountCents * paymentsPerYear[price.frequency];
          return (
            <label
              key={price.frequency}
              className={cx(
                "flex min-h-14 items-center gap-3 rounded-md border px-3 py-2 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent",
                checked ? "border-accent bg-accent-soft" : "border-line hover:bg-paper",
              )}
            >
              <input
                type="radio"
                name={name}
                value={price.frequency}
                checked={checked}
                onChange={() => setFrequency(price.frequency)}
                className="size-4 shrink-0 accent-accent"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-ink">{frequencyNames[price.frequency]}</span>
                {compare && price.frequency !== "YEAR" && (
                  <span className="text-xs text-muted">soit {formatAmount(yearly, plan.currency)} par an</span>
                )}
              </span>
              <span className="text-right whitespace-nowrap">
                <span className="text-base font-semibold text-ink">{formatAmount(price.amountCents, plan.currency)}</span>{" "}
                <span className="text-xs text-muted">{frequencyUnits[price.frequency]}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {selected.purchasable ? (
        <SubscribeButton planId={plan.id} planName={plan.name} frequency={selected.frequency} />
      ) : (
        <p className="text-sm text-muted">Cette fréquence n&apos;est pas encore payable en ligne.</p>
      )}
    </div>
  );
}
