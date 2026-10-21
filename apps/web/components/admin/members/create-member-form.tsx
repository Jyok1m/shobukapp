"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { apiRequest } from "@/lib/client-api";
import { emailTakenAdmin } from "@/lib/onboarding";
import type { CreatedMember } from "@/lib/types";

/* No 0/O, 1/l/I: the password is read aloud or copied by hand. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const LENGTH = 14;

/* Rejection sampling: every character equally likely (no modulo bias). */
export function generatePassword(): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(LENGTH * 2))) {
      if (byte < limit && out.length < LENGTH) out += ALPHABET[byte % ALPHABET.length];
    }
  }
  return out;
}

type Key = "firstName" | "lastName" | "email" | "temporaryPassword";
type Errors = Partial<Record<Key, string>>;

export function CreateMemberForm() {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim();
    const values = { firstName: text("firstName"), lastName: text("lastName"), email: text("email"), phone: text("phone") };
    const next: Errors = {};
    if (!values.firstName) next.firstName = "Indiquez le prénom.";
    if (!values.lastName) next.lastName = "Indiquez le nom.";
    if (!/^\S+@\S+\.\S+$/.test(values.email)) next.email = "Indiquez une adresse e-mail valide.";
    if (password.length < 10 || password.length > 128)
      next.temporaryPassword = "Le mot de passe provisoire compte de 10 à 128 caractères. Utilisez « Générer ».";
    setErrors(next);
    setError(null);
    if (Object.keys(next).length > 0) return;

    const { phone, ...rest } = values;
    setPending(true);
    const result = await apiRequest<CreatedMember>("POST", "/admin/members", {
      ...rest,
      ...(phone && { phone }),
      temporaryPassword: password,
    });
    if (!result.ok) {
      setPending(false);
      return setError(result.code === "email_taken" ? emailTakenAdmin : result.error);
    }
    // Fresh form if the admin comes back, and the password leaves the page state.
    form.current?.reset();
    setPassword("");
    setVisible(false);
    router.push(`/admin/membres/${result.data.user.id}?cree=${result.data.delivery}`);
  }

  return (
    <Card
      title="Nouveau membre"
      description="Pour un pratiquant qui ne peut pas créer son compte lui-même. Il recevra un e-mail de bienvenue, sans le mot de passe."
    >
      <form ref={form} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="new-first-name" label="Prénom" error={errors.firstName}>
            {(control) => <Input {...control} name="firstName" maxLength={80} autoComplete="off" />}
          </Field>
          <Field id="new-last-name" label="Nom" error={errors.lastName}>
            {(control) => <Input {...control} name="lastName" maxLength={80} autoComplete="off" />}
          </Field>
          <Field id="new-email" label="Adresse e-mail" error={errors.email}>
            {(control) => <Input {...control} name="email" type="email" maxLength={254} autoComplete="off" />}
          </Field>
          <Field id="new-phone" label="Téléphone (facultatif)">
            {(control) => <Input {...control} name="phone" type="tel" inputMode="tel" maxLength={30} autoComplete="off" />}
          </Field>
        </div>

        <Field
          id="new-password"
          label="Mot de passe provisoire"
          hint="Le membre devra choisir son propre mot de passe à sa première connexion."
          error={errors.temporaryPassword}
        >
          {(control) => (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                {...control}
                type={visible ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                /* Not new-password: the browser would offer to save the member's address and temporary password in the admin's keychain. */
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                spellCheck={false}
                maxLength={128}
                className="font-mono"
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPassword(generatePassword());
                    setVisible(true);
                  }}
                >
                  Générer
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setVisible((value) => !value)}
                  aria-pressed={visible}
                  aria-controls="new-password"
                >
                  {visible ? "Masquer" : "Afficher"}
                </Button>
                {password && <CopyButton value={password} />}
              </div>
            </div>
          )}
        </Field>
        <Notice tone="warning">
          Ce mot de passe n&apos;est pas envoyé par e-mail : remettez-le au membre en main propre, puis ne le conservez
          pas.
        </Notice>

        <FormAlert message={error} />
        <Button type="submit" loading={pending} className="self-start">
          Créer le compte
        </Button>
      </form>
    </Card>
  );
}
