"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormAlert } from "./form-alert";
import { postJson } from "./post-json";

const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;

type FieldErrors = Partial<Record<"email" | "password" | "firstName" | "lastName" | "acceptTerms", string>>;

function validate(values: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.firstName) errors.firstName = "Indiquez votre prénom.";
  if (!values.lastName) errors.lastName = "Indiquez votre nom.";
  if (!/^\S+@\S+\.\S+$/.test(values.email)) errors.email = "Indiquez une adresse e-mail valide.";
  if (values.password.length < PASSWORD_MIN)
    errors.password = `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`;
  else if (values.password.length > PASSWORD_MAX)
    errors.password = `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX} caractères.`;
  if (!values.acceptTerms)
    errors.acceptTerms = "Vous devez accepter les conditions d'utilisation pour créer un compte.";
  return errors;
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = {
      firstName: String(data.get("firstName") ?? "").trim(),
      lastName: String(data.get("lastName") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
      acceptTerms: data.get("acceptTerms") === "on",
    };
    const errors = validate(values);
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    const result = await postJson("/auth/register", { ...values, acceptTerms: true });
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push("/tableau-de-bord");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="Prénom" error={fieldErrors.firstName}>
          {(control) => (
            <Input {...control} name="firstName" autoComplete="given-name" maxLength={80} required />
          )}
        </Field>
        <Field id="lastName" label="Nom" error={fieldErrors.lastName}>
          {(control) => (
            <Input {...control} name="lastName" autoComplete="family-name" maxLength={80} required />
          )}
        </Field>
      </div>
      <Field id="email" label="Adresse e-mail" error={fieldErrors.email}>
        {(control) => (
          <Input {...control} name="email" type="email" autoComplete="email" maxLength={254} required />
        )}
      </Field>
      <Field
        id="password"
        label="Mot de passe"
        hint={`Au moins ${PASSWORD_MIN} caractères.`}
        error={fieldErrors.password}
      >
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
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-3">
          <input
            id="acceptTerms"
            name="acceptTerms"
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-invalid={fieldErrors.acceptTerms ? true : undefined}
            aria-describedby={fieldErrors.acceptTerms ? "acceptTerms-error" : undefined}
          />
          <label htmlFor="acceptTerms" className="text-sm text-ink">
            J&apos;accepte les conditions d&apos;utilisation et la politique de confidentialité du
            Shobukan Dojo.
          </label>
        </div>
        {fieldErrors.acceptTerms && (
          <p id="acceptTerms-error" className="text-xs font-medium text-danger">
            {fieldErrors.acceptTerms}
          </p>
        )}
      </div>
      <Button type="submit" loading={pending} className="mt-2 w-full">
        Créer mon compte
      </Button>
      <p className="text-center text-sm text-muted">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-medium text-accent hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
