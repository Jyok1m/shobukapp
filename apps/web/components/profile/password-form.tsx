"use client";

import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { apiRequest } from "@/lib/client-api";

const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;

type FieldErrors = Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>;

export function PasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");

    const errors: FieldErrors = {};
    if (!currentPassword) errors.currentPassword = "Indiquez votre mot de passe actuel.";
    if (newPassword.length < PASSWORD_MIN)
      errors.newPassword = `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`;
    else if (newPassword.length > PASSWORD_MAX)
      errors.newPassword = `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX} caractères.`;
    if (confirmPassword !== newPassword) errors.confirmPassword = "Les deux mots de passe ne correspondent pas.";
    setFieldErrors(errors);
    setError(null);
    setSaved(false);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    const result = await apiRequest("POST", "/auth/password", { currentPassword, newPassword });
    setPending(false);
    if (!result.ok) {
      if (result.code === "invalid_credentials") {
        setFieldErrors({ currentPassword: "Mot de passe actuel incorrect." });
      } else {
        setError(result.error);
      }
      return;
    }
    form.reset();
    setSaved(true);
  }

  return (
    <Card title="Mot de passe">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field id="currentPassword" label="Mot de passe actuel" error={fieldErrors.currentPassword}>
          {(control) => (
            <Input {...control} name="currentPassword" type="password" autoComplete="current-password" required />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="newPassword"
            label="Nouveau mot de passe"
            hint={`Au moins ${PASSWORD_MIN} caractères.`}
            error={fieldErrors.newPassword}
          >
            {(control) => (
              <Input
                {...control}
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={PASSWORD_MIN}
                maxLength={PASSWORD_MAX}
                required
              />
            )}
          </Field>
          <Field id="confirmPassword" label="Confirmer le nouveau mot de passe" error={fieldErrors.confirmPassword}>
            {(control) => (
              <Input {...control} name="confirmPassword" type="password" autoComplete="new-password" required />
            )}
          </Field>
        </div>
        <FormAlert message={error} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" variant="secondary" loading={pending}>
            Changer le mot de passe
          </Button>
          {saved && <Notice tone="success">Mot de passe modifié. Vos autres appareils ont été déconnectés.</Notice>}
        </div>
      </form>
    </Card>
  );
}
