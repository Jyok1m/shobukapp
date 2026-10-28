"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ConsentCheckbox } from "@/components/onboarding/consent-checkbox";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordRules } from "@/components/ui/password-rules";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/client-api";
import { PASSWORD_MAX, PASSWORD_MIN, passwordLengthError } from "@/lib/password";
import { FormAlert } from "./form-alert";

type Key = "newPassword" | "confirmation" | "acceptTerms";
type Errors = Partial<Record<Key, string>>;

/* POST /auth/password/reset. The terms checkbox only appears if the API asks for it (account created by an admin). */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const toast = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [needsTerms, setNeedsTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState(false);
  const [navigating, startNavigation] = useTransition();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const acceptTerms = new FormData(event.currentTarget).get("acceptTerms") === "on";
    const next: Errors = {};
    const lengthError = passwordLengthError(newPassword);
    if (lengthError) next.newPassword = lengthError;
    if (confirmation !== newPassword) next.confirmation = "Les deux mots de passe ne correspondent pas.";
    if (needsTerms && !acceptTerms) next.acceptTerms = "Vous devez accepter les conditions d'utilisation pour continuer.";
    setErrors(next);
    setError(null);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    const result = await apiRequest("POST", "/auth/password/reset", {
      token,
      newPassword,
      ...(needsTerms && { acceptTerms: true }),
    });
    if (!result.ok) {
      setPending(false);
      if (result.code === "terms_required") {
        setNeedsTerms(true);
        return setErrors({ acceptTerms: "Une dernière étape : acceptez les conditions d'utilisation, puis validez à nouveau." });
      }
      if (result.code === "invalid_reset_token") setExpired(true);
      return setError(result.error);
    }
    toast.success("Mot de passe modifié", "Connectez-vous avec votre nouveau mot de passe.");
    startNavigation(() => {
      setPending(false);
      router.replace("/connexion");
      router.refresh();
    });
  }

  if (expired) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert message={error} />
        <Link href="/mot-de-passe-oublie" className="text-center text-sm font-medium text-accent hover:underline">
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={error} />
      <Field id="newPassword" label="Nouveau mot de passe" error={errors.newPassword}>
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
            autoFocus
          />
        )}
      </Field>
      <Field id="confirmation" label="Confirmez le nouveau mot de passe" error={errors.confirmation}>
        {(control) => (
          <PasswordInput
            {...control}
            name="confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            required
          />
        )}
      </Field>
      <PasswordRules id="new-password-rules" password={newPassword} confirmation={confirmation} />
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
        Enregistrer mon nouveau mot de passe
      </Button>
    </form>
  );
}
