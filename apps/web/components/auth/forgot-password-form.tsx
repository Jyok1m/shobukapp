"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/client-api";
import { FormAlert } from "./form-alert";

/* The API answers the same whether the address has an account or not: so does this form. */
export function ForgotPasswordForm() {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setEmailError("Indiquez une adresse e-mail valide.");
    setEmailError(null);
    setPending(true);
    const result = await apiRequest("POST", "/auth/password/forgot", { email });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setSentTo(email);
    toast.success("Demande envoyée", "Pensez à regarder dans vos courriers indésirables.");
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="success">
          Si un compte existe pour <strong>{sentTo}</strong>, un e-mail vient de partir avec un lien pour choisir un
          nouveau mot de passe.
        </Notice>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-ink">
          <li>Ouvrez l&apos;e-mail « Réinitialisation de votre mot de passe » (regardez aussi les indésirables).</li>
          <li>Cliquez sur le lien : il est valable une heure et ne sert qu&apos;une fois.</li>
          <li>Choisissez votre nouveau mot de passe, puis connectez-vous.</li>
        </ol>
        <p className="text-sm text-muted">
          Rien reçu après quelques minutes ?{" "}
          <button type="button" onClick={() => setSentTo(null)} className="font-medium text-accent hover:underline">
            Renvoyer un lien
          </button>{" "}
          ou contactez le bureau.
        </p>
        <Link href="/connexion" className="text-center text-sm font-medium text-accent hover:underline">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={error} />
      <Field id="email" label="Adresse e-mail" hint="Celle que vous utilisez pour vous connecter." error={emailError}>
        {(control) => (
          <Input {...control} name="email" type="email" autoComplete="email" maxLength={254} required autoFocus />
        )}
      </Field>
      <Button type="submit" loading={pending} className="mt-2 w-full">
        Recevoir le lien
      </Button>
      <Link href="/connexion" className="text-center text-sm font-medium text-accent hover:underline">
        Retour à la connexion
      </Link>
    </form>
  );
}
