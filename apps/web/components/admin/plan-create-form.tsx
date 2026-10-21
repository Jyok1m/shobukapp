"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { apiRequest } from "@/lib/client-api";
import type { AdminPlan } from "@/lib/types";
import { PlanFields, readPlanForm, type PlanFieldErrors } from "./plan-fields";

export function PlanCreateForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<PlanFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<AdminPlan | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const { values, errors: fieldErrors } = readPlanForm(new FormData(form));
    setErrors(fieldErrors);
    setError(null);
    setCreated(null);
    if (Object.keys(fieldErrors).length > 0) return;

    setPending(true);
    const result = await apiRequest<AdminPlan>("POST", "/admin/plans", {
      name: values.name,
      ...(values.description && { description: values.description }),
      amountCents: values.amountCents,
      interval: values.interval,
      sortOrder: values.sortOrder,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    form.reset();
    setCreated(result.data);
    router.refresh();
  }

  return (
    <Card
      title="Nouvelle formule"
      description="La formule est créée dans Stripe en même temps, puis proposée aux pratiquants."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <PlanFields idPrefix="create" errors={errors} />
        <FormAlert message={error} />
        {created && (
          <Notice tone="success">
            Formule « {created.name} » créée
            {created.stripePriceId ? " et synchronisée avec Stripe." : ". Elle n'est pas encore synchronisée avec Stripe."}
          </Notice>
        )}
        <Button type="submit" loading={pending} className="self-start">
          Créer la formule
        </Button>
      </form>
    </Card>
  );
}
