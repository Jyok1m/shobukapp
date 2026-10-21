"use client";

import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { apiRequest } from "@/lib/client-api";
import type { AdminPlan } from "@/lib/types";
import { PlanFields, readPlanForm, type PlanFieldErrors } from "./plan-fields";

type PlanEditDialogProps = {
  plan: AdminPlan | null;
  onClose: () => void;
  onSaved: () => void;
};

export function PlanEditDialog({ plan, onClose, onSaved }: PlanEditDialogProps) {
  return (
    <Dialog
      open={plan !== null}
      title={plan ? `Modifier « ${plan.name} »` : "Modifier la formule"}
      onClose={onClose}
      className="max-w-xl"
    >
      {/* Keyed on the plan: the form state starts fresh for each plan opened. */}
      {plan && <PlanEditForm key={plan.id} plan={plan} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

function PlanEditForm({ plan, onClose, onSaved }: { plan: AdminPlan; onClose: () => void; onSaved: () => void }) {
  const [errors, setErrors] = useState<PlanFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const synced = Boolean(plan.stripeProductId && plan.stripePriceId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { values, errors: fieldErrors } = readPlanForm(new FormData(event.currentTarget));
    setErrors(fieldErrors);
    setError(null);
    if (Object.keys(fieldErrors).length > 0) return;

    // Only what changed. An empty body still syncs an unsynced plan with Stripe.
    const changes: Record<string, unknown> = {};
    if (values.name !== plan.name) changes.name = values.name;
    if (values.description !== (plan.description ?? "")) changes.description = values.description;
    if (values.amountCents !== plan.amountCents) changes.amountCents = values.amountCents;
    if (values.interval !== plan.interval) changes.interval = values.interval;
    if (values.sortOrder !== plan.sortOrder) changes.sortOrder = values.sortOrder;

    if (Object.keys(changes).length === 0 && synced) return onClose();

    setPending(true);
    const result = await apiRequest<AdminPlan>("PATCH", `/admin/plans/${plan.id}`, changes);
    setPending(false);
    if (!result.ok) return setError(result.error);
    onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Notice>
        Modifier le montant ou la périodicité crée un nouveau prix dans Stripe. Les abonnés actuels conservent
        l&apos;ancien tarif jusqu&apos;à ce qu&apos;ils changent de formule ; seuls les nouveaux abonnements
        utilisent le nouveau.
      </Notice>
      {!synced && (
        <Notice tone="danger">
          Cette formule n&apos;est pas synchronisée avec Stripe. L&apos;enregistrer la créera dans Stripe.
        </Notice>
      )}
      <PlanFields idPrefix={`edit-${plan.id}`} plan={plan} errors={errors} />
      <FormAlert message={error} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" loading={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
