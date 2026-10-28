"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/client-api";
import { emailTakenAdmin } from "@/lib/onboarding";
import type { CodeInvitationResult } from "@/lib/types";
import { DeliveryPanel } from "./delivery-panel";

type Errors = Partial<Record<"firstName" | "lastName" | "email", string>>;

export function CodeInvitationForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<(CodeInvitationResult & { email: string }) | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim();
    const values = { firstName: text("firstName"), lastName: text("lastName"), email: text("email") };
    const next: Errors = {};
    if (!values.firstName) next.firstName = "Indiquez le prénom.";
    if (!values.lastName) next.lastName = "Indiquez le nom.";
    if (!/^\S+@\S+\.\S+$/.test(values.email)) next.email = "Indiquez une adresse e-mail valide.";
    setErrors(next);
    setError(null);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    const result = await apiRequest<CodeInvitationResult>("POST", "/admin/invitations", values);
    setPending(false);
    if (!result.ok) return setError(result.code === "email_taken" ? emailTakenAdmin : result.error);
    setCreated({ ...result.data, email: values.email });
    setFormKey((key) => key + 1);
    router.refresh();
  }

  return (
    <Card
      title="Créer un code d'activation"
      description="Pour un pratiquant qui fréquente déjà le dojo. Il reçoit le code par e-mail et crée son compte depuis « Activer mon compte ». Un nouveau code pour la même adresse annule le précédent."
    >
      <div className="flex flex-col gap-4">
        <form key={formKey} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="invite-first-name" label="Prénom" error={errors.firstName}>
              {(control) => <Input {...control} name="firstName" maxLength={80} autoComplete="off" />}
            </Field>
            <Field id="invite-last-name" label="Nom" error={errors.lastName}>
              {(control) => <Input {...control} name="lastName" maxLength={80} autoComplete="off" />}
            </Field>
            <Field
              id="invite-email"
              label="Adresse e-mail"
              hint="Le code y est envoyé, et le compte sera créé avec cette adresse : vérifiez-la avec le pratiquant."
              error={errors.email}
              className="sm:col-span-2"
            >
              {(control) => <Input {...control} name="email" type="email" maxLength={254} autoComplete="off" />}
            </Field>
          </div>
          <FormAlert message={error} />
          <Button type="submit" loading={pending} className="self-start">
            Créer le code
          </Button>
        </form>
        {created && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink">
              Code pour <span className="font-medium">{created.email}</span> :
            </p>
            <DeliveryPanel kind="code" value={created.code} expiresAt={created.expiresAt} delivery={created.delivery} once />
          </div>
        )}
      </div>
    </Card>
  );
}
