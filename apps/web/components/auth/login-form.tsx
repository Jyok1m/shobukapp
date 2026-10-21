"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormAlert } from "./form-alert";
import { postJson } from "./post-json";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [navigating, startNavigation] = useTransition();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await postJson("/auth/login", {
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
    });
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    // Next keeps this component's state across navigations: clear pending inside the transition, so it stays busy until the next page shows.
    startNavigation(() => {
      setPending(false);
      router.push("/tableau-de-bord");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={error} />
      <Field id="email" label="Adresse e-mail">
        {(control) => (
          <Input {...control} name="email" type="email" autoComplete="email" required />
        )}
      </Field>
      <Field id="password" label="Mot de passe">
        {(control) => (
          <Input
            {...control}
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        )}
      </Field>
      <Button type="submit" loading={pending || navigating} className="mt-2 w-full">
        Se connecter
      </Button>
      <div className="flex flex-col gap-2 border-t border-line pt-4 text-center text-sm">
        <Link href="/activation" className="font-medium text-accent hover:underline">
          Je pratique déjà au dojo mais je n&apos;ai pas encore de compte
        </Link>
        <p className="text-muted">
          Pas encore pratiquant ?{" "}
          <Link href="/nous-rejoindre" className="font-medium text-accent hover:underline">
            Nous rejoindre
          </Link>
        </p>
      </div>
    </form>
  );
}
