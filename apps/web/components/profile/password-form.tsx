"use client";

import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordRules } from "@/components/ui/password-rules";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/client-api";
import { PASSWORD_MAX, PASSWORD_MIN, passwordLengthError } from "@/lib/password";

type FieldErrors = Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>;

export function PasswordForm() {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: FieldErrors = {};
    if (!currentPassword) errors.currentPassword = "Indiquez votre mot de passe actuel.";
    const lengthError = passwordLengthError(newPassword);
    if (lengthError) errors.newPassword = lengthError;
    else if (newPassword === currentPassword)
      errors.newPassword = "Choisissez un mot de passe différent de l'actuel.";
    if (confirmPassword !== newPassword) errors.confirmPassword = "Les deux mots de passe ne correspondent pas.";
    setFieldErrors(errors);
    setError(null);
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
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Mot de passe modifié", "Vos autres appareils ont été déconnectés.");
  }

  return (
    <Card
      title="Mot de passe"
      description="Saisissez d'abord votre mot de passe actuel, puis le nouveau deux fois. Le bouton en forme d'œil affiche ce que vous tapez."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field id="currentPassword" label="Mot de passe actuel" error={fieldErrors.currentPassword}>
          {(control) => (
            <PasswordInput
              {...control}
              name="currentPassword"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              maxLength={PASSWORD_MAX}
              required
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="newPassword" label="Nouveau mot de passe" error={fieldErrors.newPassword}>
            {(control) => (
              <PasswordInput
                {...control}
                aria-describedby={[control["aria-describedby"], "new-password-rules"].filter(Boolean).join(" ")}
                name="newPassword"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={PASSWORD_MIN}
                maxLength={PASSWORD_MAX}
                required
              />
            )}
          </Field>
          <Field id="confirmPassword" label="Confirmer le nouveau mot de passe" error={fieldErrors.confirmPassword}>
            {(control) => (
              <PasswordInput
                {...control}
                name="confirmPassword"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                maxLength={PASSWORD_MAX}
                required
              />
            )}
          </Field>
        </div>
        <PasswordRules
          id="new-password-rules"
          password={newPassword}
          confirmation={confirmPassword}
          differentFrom={{ value: currentPassword, label: "du mot de passe actuel" }}
        />
        <FormAlert message={error} />
        <Button type="submit" variant="secondary" loading={pending} className="self-start">
          Changer le mot de passe
        </Button>
      </form>
    </Card>
  );
}
