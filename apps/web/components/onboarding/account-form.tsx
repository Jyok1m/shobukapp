"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/client-api";
import { ConsentCheckbox } from "./consent-checkbox";

const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;

export const invalidCodeMessage =
  "Code ou adresse incorrects, ou code expiré. Après 5 essais, le code est bloqué : demandez-en un nouveau au bureau.";

type Mode =
  /* Link from a join request: the email comes from the invitation and is never sent. */
  | { kind: "link"; token: string; email: string; firstName: string; lastName: string }
  /* Existing practitioner: email and the code given by the bureau. */
  | { kind: "code" };

type Key = "email" | "code" | "firstName" | "lastName" | "password" | "acceptTerms";
type Errors = Partial<Record<Key, string>>;

/* Normalised by the API too (case, spaces, O as 0, I and L as 1): only the obvious here. */
function normaliseCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

export function AccountForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim();
    const firstName = text("firstName");
    const lastName = text("lastName");
    const password = String(data.get("password") ?? "");
    const email = mode.kind === "code" ? text("email") : mode.email;
    const code = mode.kind === "code" ? normaliseCode(text("code")) : "";

    const next: Errors = {};
    if (!firstName) next.firstName = "Indiquez votre prénom.";
    if (!lastName) next.lastName = "Indiquez votre nom.";
    if (mode.kind === "code") {
      if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Indiquez l'adresse e-mail à laquelle vous avez reçu le code.";
      if (code.replace(/-/g, "").length !== 8) next.code = "Le code compte 8 caractères, au format XXXX-XXXX.";
    }
    if (password.length < PASSWORD_MIN) next.password = `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`;
    else if (password.length > PASSWORD_MAX)
      next.password = `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX} caractères.`;
    if (data.get("acceptTerms") !== "on")
      next.acceptTerms = "Vous devez accepter les conditions d'utilisation pour créer un compte.";
    setErrors(next);
    setError(null);
    setExpired(false);
    if (Object.keys(next).length > 0) return;

    const credentials = mode.kind === "link" ? { token: mode.token } : { email, code };
    setPending(true);
    const result = await apiRequest("POST", "/auth/register", {
      ...credentials,
      firstName,
      lastName,
      password,
      acceptTerms: true,
    });
    if (!result.ok) {
      setPending(false);
      if (result.code === "invalid_invitation") {
        if (mode.kind === "code") return setError(invalidCodeMessage);
        setExpired(true);
        return setError("Ce lien d'inscription n'est plus valable.");
      }
      if (result.code === "email_taken") {
        return setError("Un compte existe déjà avec cette adresse e-mail. Connectez-vous ou contactez le bureau.");
      }
      return setError(result.error);
    }
    router.push("/tableau-de-bord");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={error} />
      {expired && (
        <p className="text-sm text-muted">
          Demandez un nouveau lien au bureau, ou{" "}
          <Link href="/nous-rejoindre" className="font-medium text-accent hover:underline">
            écrivez-nous
          </Link>
          .
        </p>
      )}
      {mode.kind === "link" ? (
        <Field id="email" label="Adresse e-mail" hint="L'adresse de votre invitation. Elle servira à vous connecter.">
          {(control) => <Input {...control} value={mode.email} readOnly disabled />}
        </Field>
      ) : (
        <>
          <Field id="email" label="Adresse e-mail" hint="Celle à laquelle le bureau vous a envoyé le code." error={errors.email}>
            {(control) => <Input {...control} name="email" type="email" autoComplete="email" maxLength={254} required />}
          </Field>
          <Field id="code" label="Code d'activation" hint="Format XXXX-XXXX, majuscules ou minuscules." error={errors.code}>
            {(control) => (
              <Input
                {...control}
                name="code"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={16}
                placeholder="XXXX-XXXX"
                className="font-mono tracking-widest uppercase"
                required
              />
            )}
          </Field>
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="Prénom" error={errors.firstName}>
          {(control) => (
            <Input
              {...control}
              name="firstName"
              autoComplete="given-name"
              maxLength={80}
              defaultValue={mode.kind === "link" ? mode.firstName : undefined}
              required
            />
          )}
        </Field>
        <Field id="lastName" label="Nom" error={errors.lastName}>
          {(control) => (
            <Input
              {...control}
              name="lastName"
              autoComplete="family-name"
              maxLength={80}
              defaultValue={mode.kind === "link" ? mode.lastName : undefined}
              required
            />
          )}
        </Field>
      </div>
      <Field id="password" label="Mot de passe" hint={`Au moins ${PASSWORD_MIN} caractères.`} error={errors.password}>
        {(control) => (
          <Input
            {...control}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            required
          />
        )}
      </Field>
      <ConsentCheckbox id="acceptTerms" error={errors.acceptTerms}>
        J&apos;accepte les conditions d&apos;utilisation et la{" "}
        <Link href="/confidentialite" target="_blank" rel="noopener" className="font-medium text-accent underline underline-offset-2">
          politique de confidentialité
        </Link>{" "}
        du Shobukan Dojo (s&apos;ouvre dans un nouvel onglet).
      </ConsentCheckbox>
      <Button type="submit" loading={pending} className="mt-2 w-full">
        Créer mon compte
      </Button>
      <p className="text-center text-sm text-muted">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="font-medium text-accent hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
