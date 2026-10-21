import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FREQUENCIES, frequencyNames, frequencyUnits } from "@/lib/format";
import type { AdminPlan, Frequency } from "@/lib/types";

export type PlanFieldErrors = Partial<Record<"name" | "sortOrder" | "prices" | `amount-${Frequency}`, string>>;

export type PriceValue = { frequency: Frequency; amountCents: number; active: boolean };

export type PlanValues = {
  name: string;
  description: string;
  sortOrder: number;
  /* Only the rows worth sending: offered ones, plus unchecked ones that exist or carry an amount. */
  prices: PriceValue[];
};

const MIN_CENTS = 100;
const MAX_CENTS = 1_000_000;

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/* Reads the plan form. Amounts are typed in euros, sent in cents. */
export function readPlanForm(data: FormData, plan?: AdminPlan): { values: PlanValues; errors: PlanFieldErrors } {
  const name = String(data.get("name") ?? "").trim();
  const description = String(data.get("description") ?? "").trim();
  const rawSort = String(data.get("sortOrder") ?? "").trim();
  const sortOrder = rawSort === "" ? 0 : Number(rawSort);

  const errors: PlanFieldErrors = {};
  if (!name) errors.name = "Indiquez le nom de la formule.";
  if (!Number.isInteger(sortOrder) || sortOrder < 0) errors.sortOrder = "Indiquez un nombre entier positif.";

  const prices: PriceValue[] = [];
  for (const frequency of FREQUENCIES) {
    const offered = data.get(`offered-${frequency}`) === "on";
    const raw = String(data.get(`amount-${frequency}`) ?? "").trim().replace(/\s/g, "").replace(",", ".");
    const exists = plan?.prices.some((price) => price.frequency === frequency) ?? false;
    if (!offered && !raw && !exists) continue;

    const valid = /^\d+(\.\d{1,2})?$/.test(raw);
    const amountCents = valid ? Math.round(Number(raw) * 100) : NaN;
    const key = `amount-${frequency}` as const;
    if (offered || raw) {
      if (!valid) errors[key] = "Indiquez un montant en euros, par exemple 180 ou 15,50.";
      else if (amountCents < MIN_CENTS) errors[key] = "Le montant minimum est de 1 €.";
      else if (amountCents > MAX_CENTS) errors[key] = "Le montant maximum est de 10 000 €.";
    }
    // An existing row left empty and unchecked keeps its amount: only `active` changes.
    const current = plan?.prices.find((price) => price.frequency === frequency);
    prices.push({ frequency, amountCents: valid ? amountCents : (current?.amountCents ?? 0), active: offered });
  }
  if (!prices.some((price) => price.active)) errors.prices = "Proposez au moins une fréquence de paiement.";

  return { values: { name, description, sortOrder, prices }, errors };
}

function PriceRow({
  idPrefix,
  frequency,
  plan,
  error,
}: {
  idPrefix: string;
  frequency: Frequency;
  plan?: AdminPlan;
  error?: string;
}) {
  const current = plan?.prices.find((price) => price.frequency === frequency);
  const amountId = `${idPrefix}-amount-${frequency}`;
  const offeredId = `${idPrefix}-offered-${frequency}`;
  const errorId = `${amountId}-error`;
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-3 sm:grid-cols-[8rem_1fr_auto]">
      <label htmlFor={amountId} className="col-span-2 text-sm font-medium text-ink sm:col-span-1">
        {frequencyNames[frequency]}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={amountId}
          name={`amount-${frequency}`}
          inputMode="decimal"
          defaultValue={current ? centsToInput(current.amountCents) : ""}
          placeholder="0,00"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="w-28 shrink-0"
        />
        <span className="text-sm whitespace-nowrap text-muted">€ {frequencyUnits[frequency]}</span>
      </div>
      <label htmlFor={offeredId} className="flex min-h-11 items-center gap-2 text-sm text-ink sm:min-h-0">
        <input
          id={offeredId}
          name={`offered-${frequency}`}
          type="checkbox"
          defaultChecked={plan ? Boolean(current?.active) : frequency === "YEAR"}
          className="size-4 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        Proposé<span className="sr-only"> ({frequencyNames[frequency].toLowerCase()})</span>
      </label>
      {error && (
        <p id={errorId} className="col-span-2 text-xs font-medium text-danger sm:col-span-3">
          {error}
        </p>
      )}
    </div>
  );
}

export function PlanFields({
  idPrefix,
  plan,
  errors,
}: {
  idPrefix: string;
  plan?: AdminPlan;
  errors: PlanFieldErrors;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id={id("name")} label="Nom" error={errors.name} className="sm:col-span-2">
        {(control) => <Input {...control} name="name" defaultValue={plan?.name} maxLength={80} required />}
      </Field>
      <Field
        id={id("description")}
        label="Description"
        hint="Facultatif. Affichée aux pratiquants sous le nom de la formule."
        className="sm:col-span-2"
      >
        {(control) => (
          <Textarea {...control} name="description" defaultValue={plan?.description ?? ""} maxLength={500} rows={3} />
        )}
      </Field>
      <fieldset className="flex flex-col sm:col-span-2" aria-describedby={errors.prices ? id("prices-error") : undefined}>
        <legend className="text-sm font-medium text-ink">Fréquences de paiement</legend>
        <p className="text-xs text-muted">
          Le pratiquant choisit parmi les fréquences proposées. Chaque montant est libre : une remise sur
          l&apos;annuel est simplement un montant plus bas.
        </p>
        <div className="mt-1 divide-y divide-line">
          {FREQUENCIES.map((frequency) => (
            <PriceRow
              key={frequency}
              idPrefix={idPrefix}
              frequency={frequency}
              plan={plan}
              error={errors[`amount-${frequency}`]}
            />
          ))}
        </div>
        {errors.prices && (
          <p id={id("prices-error")} className="text-xs font-medium text-danger">
            {errors.prices}
          </p>
        )}
      </fieldset>
      <Field
        id={id("sortOrder")}
        label="Ordre d'affichage"
        hint="Les formules s'affichent de la plus petite valeur à la plus grande."
        error={errors.sortOrder}
      >
        {(control) => (
          <Input
            {...control}
            name="sortOrder"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={plan?.sortOrder ?? 0}
          />
        )}
      </Field>
    </div>
  );
}
