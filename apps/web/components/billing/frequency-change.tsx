"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { apiRequest } from "@/lib/client-api";
import { cx } from "@/lib/cx";
import { formatAmount, frequencyAdjectives, frequencyNames, frequencyUnits } from "@/lib/format";
import type { Frequency, FrequencyPreview, Membership, PublicPlanPrice } from "@/lib/types";

type Step = "closed" | "choose" | "confirm";

/* The API answers 402 payment_declined when Stripe left the change pending; other Stripe errors keep their generic text. */
function frequencyError(result: { code: string | null; error: string }): string {
  if (result.code === "payment_declined") return "Le paiement a été refusé : votre fréquence actuelle est conservée.";
  return result.error;
}

/*
 * Same cotisation, another of its offered frequencies. Stripe invoices the
 * difference today (unused time credited) and the new period starts now.
 */
export function FrequencyChange({
  current,
  prices,
  currency,
  testMode,
}: {
  current: Frequency;
  prices: PublicPlanPrice[];
  currency: string;
  testMode: boolean;
}) {
  const router = useRouter();
  const name = useId();
  const others = prices.filter((price) => price.frequency !== current && price.purchasable);
  const [step, setStep] = useState<Step>("closed");
  const [choice, setChoice] = useState<Frequency | null>(null);
  const [preview, setPreview] = useState<FrequencyPreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (others.length === 0) return null;

  function reset() {
    setStep("closed");
    setChoice(null);
    setPreview(null);
    setError(null);
  }

  async function askPreview() {
    if (!choice) return setError("Choisissez une fréquence.");
    setPending(true);
    setError(null);
    const result = await apiRequest<FrequencyPreview>("POST", "/billing/subscription/frequency/preview", { frequency: choice });
    setPending(false);
    if (!result.ok) return setError(frequencyError(result));
    setPreview(result.data);
    setStep("confirm");
  }

  async function apply() {
    if (!choice) return;
    setPending(true);
    setError(null);
    const result = await apiRequest<Membership>("POST", "/billing/subscription/frequency", { frequency: choice });
    setPending(false);
    if (!result.ok) return setError(frequencyError(result));
    setDone(`Votre cotisation est maintenant ${frequencyAdjectives[choice]}.`);
    reset();
    router.refresh();
  }

  if (step === "closed") {
    return (
      <div className="flex flex-col gap-3">
        {done && <Notice tone="success">{done}</Notice>}
        <Button
          variant="secondary"
          className="self-start"
          onClick={() => {
            setDone(null);
            setStep("choose");
          }}
        >
          Changer de fréquence
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-line bg-paper p-4">
      {step === "choose" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-ink">
            Nouvelle fréquence (actuellement : {frequencyAdjectives[current]})
          </legend>
          {others.map((price) => (
            <label
              key={price.frequency}
              className={cx(
                "flex min-h-14 items-center gap-3 rounded-md border bg-surface px-3 py-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent",
                choice === price.frequency ? "border-accent" : "border-line",
              )}
            >
              <input
                type="radio"
                name={name}
                value={price.frequency}
                checked={choice === price.frequency}
                onChange={() => setChoice(price.frequency)}
                className="size-4 shrink-0 accent-accent"
              />
              <span className="flex-1 text-sm font-medium text-ink">{frequencyNames[price.frequency]}</span>
              <span className="whitespace-nowrap">
                <span className="font-semibold text-ink">{formatAmount(price.amountCents, currency)}</span>{" "}
                <span className="text-xs text-muted">{frequencyUnits[price.frequency]}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        preview &&
        choice && (
          <div className="flex flex-col gap-2 text-sm text-ink">
            <p>
              Nouvelle fréquence : <span className="font-medium">{frequencyNames[choice]}</span>
            </p>
            <p className="text-base">
              Montant à régler aujourd&apos;hui :{" "}
              <span className="font-semibold">{formatAmount(preview.amountDueCents, preview.currency)}</span>
            </p>
            <p className="text-muted">
              Le temps restant de votre fréquence actuelle est déduit. Votre nouvelle période commence aujourd&apos;hui.
            </p>
            <p className="text-muted">Si le paiement est refusé, votre fréquence actuelle est conservée.</p>
            {testMode && (
              <p className="font-medium text-ink">
                Mode démonstration : aucune somme n&apos;est débitée, et ce changement ne sera pas repris en paiements
                réels.
              </p>
            )}
            {preview.creditCents > 0 && (
              <p className="text-muted">
                Il vous restera un crédit de{" "}
                <span className="font-medium text-ink">{formatAmount(preview.creditCents, preview.currency)}</span>, déduit
                automatiquement de vos prochains paiements.
              </p>
            )}
          </div>
        )
      )}
      <FormAlert message={error} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={reset} disabled={pending}>
          Annuler
        </Button>
        {step === "choose" ? (
          <Button onClick={askPreview} loading={pending} disabled={!choice}>
            Voir le montant
          </Button>
        ) : (
          <Button onClick={apply} loading={pending}>
            {preview && preview.amountDueCents > 0 ? "Confirmer et payer" : "Confirmer"}
          </Button>
        )}
      </div>
    </div>
  );
}
