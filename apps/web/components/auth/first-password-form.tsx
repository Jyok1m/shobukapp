"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ConsentCheckbox } from "@/components/onboarding/consent-checkbox";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/client-api";
import { FormAlert } from "./form-alert";

const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;

type Key = "currentPassword" | "newPassword" | "confirmation" | "acceptTerms";
type Errors = Partial<Record<Key, string>>;

/* POST /auth/password: replaces the admin-set temporary password, and records the terms if never accepted. */
export function FirstPasswordForm({ needsTerms }: { needsTerms: boolean }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [navigating, startNavigation] = useTransition();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");
    const acceptTerms = data.get("acceptTerms") === "on";

    const next: Errors = {};
    if (!currentPassword) next.currentPassword = "Saisissez le mot de passe provisoire remis par le bureau.";
    if (newPassword.length < PASSWORD_MIN) next.newPassword = `Au moins ${PASSWORD_MIN} caractères.`;
    else if (newPassword.length > PASSWORD_MAX) next.newPassword = `${PASSWORD_MAX} caractères maximum.`;
    else if (newPassword === currentPassword) next.newPassword = "Choisissez un mot de passe différent du mot de passe provisoire.";
    if (confirmation !== newPassword) next.confirmation = "Les deux mots de passe ne correspondent pas.";
    if (needsTerms && !acceptTerms) next.acceptTerms = "Vous devez accepter les conditions d'utilisation pour continuer.";
    setErrors(next);
    setError(null);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    const result = await apiRequest("POST", "/auth/password", {
      currentPassword,
      newPassword,
      ...(needsTerms && { acceptTerms: true }),
    });
    if (!result.ok) {
      setPending(false);
      if (result.code === "invalid_credentials") return setErrors({ currentPassword: "Mot de passe provisoire incorrect." });
      return setError(result.error);
    }
    // Next keeps this component's state across navigations: clear pending inside the transition, so it stays busy until the next page shows.
    startNavigation(() => {
      setPending(false);
      router.replace("/tableau-de-bord");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={error} />
      <Field id="currentPassword" label="Mot de passe provisoire" error={errors.currentPassword}>
        {(control) => (
          <Input {...control} name="currentPassword" type="password" autoComplete="current-password" maxLength={PASSWORD_MAX} required />
        )}
      </Field>
      <Field id="newPassword" label="Nouveau mot de passe" hint={`Au moins ${PASSWORD_MIN} caractères.`} error={errors.newPassword}>
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
      <Field id="confirmation" label="Confirmez le nouveau mot de passe" error={errors.confirmation}>
        {(control) => (
          <Input {...control} name="confirmation" type="password" autoComplete="new-password" maxLength={PASSWORD_MAX} required />
        )}
      </Field>
      {needsTerms && (
        <ConsentCheckbox id="acceptTerms" error={errors.acceptTerms}>
          J&apos;accepte les conditions d&apos;utilisation et la{" "}
          <Link href="/confidentialite" target="_blank" rel="noopener" className="font-medium text-accent underline underline-offset-2">
            politique de confidentialité
          </Link>{" "}
          du Shobukan Dojo (s&apos;ouvre dans un nouvel onglet).
        </ConsentCheckbox>
      )}
      <Button type="submit" loading={pending || navigating} className="mt-2 w-full">
        Enregistrer mon mot de passe
      </Button>
    </form>
  );
}
