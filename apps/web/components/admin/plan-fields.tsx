import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AdminPlan, PlanInterval } from "@/lib/types";

export type PlanFieldErrors = Partial<Record<"name" | "amount" | "sortOrder", string>>;

export type PlanValues = {
  name: string;
  description: string;
  amountCents: number;
  interval: PlanInterval;
  sortOrder: number;
};

const MIN_CENTS = 100;
const MAX_CENTS = 1_000_000;

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/* Reads the shared plan fields from a form. Amounts are typed in euros, sent in cents. */
export function readPlanForm(data: FormData): { values: PlanValues; errors: PlanFieldErrors } {
  const name = String(data.get("name") ?? "").trim();
  const description = String(data.get("description") ?? "").trim();
  const rawAmount = String(data.get("amount") ?? "").trim().replace(/\s/g, "").replace(",", ".");
  const amount = Number(rawAmount);
  const amountCents = Math.round(amount * 100);
  const rawSort = String(data.get("sortOrder") ?? "").trim();
  const sortOrder = rawSort === "" ? 0 : Number(rawSort);
  const interval = (data.get("interval") === "MONTH" ? "MONTH" : "YEAR") as PlanInterval;

  const errors: PlanFieldErrors = {};
  if (!name) errors.name = "Indiquez le nom de la formule.";
  if (!rawAmount || !/^\d+(\.\d{1,2})?$/.test(rawAmount)) errors.amount = "Indiquez un montant en euros, par exemple 180 ou 15,50.";
  else if (amountCents < MIN_CENTS) errors.amount = "Le montant minimum est de 1 €.";
  else if (amountCents > MAX_CENTS) errors.amount = "Le montant maximum est de 10 000 €.";
  if (!Number.isInteger(sortOrder) || sortOrder < 0) errors.sortOrder = "Indiquez un nombre entier positif.";

  return { values: { name, description, amountCents, interval, sortOrder }, errors };
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
      <Field id={id("amount")} label="Montant (€)" error={errors.amount}>
        {(control) => (
          <Input
            {...control}
            name="amount"
            inputMode="decimal"
            defaultValue={plan ? centsToInput(plan.amountCents) : ""}
            placeholder="180,00"
            required
          />
        )}
      </Field>
      <Field id={id("interval")} label="Périodicité">
        {(control) => (
          <Select {...control} name="interval" defaultValue={plan?.interval ?? "YEAR"}>
            <option value="YEAR">Annuelle</option>
            <option value="MONTH">Mensuelle</option>
          </Select>
        )}
      </Field>
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
