"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/client-api";
import { ConsentCheckbox } from "./consent-checkbox";
import { TrialCalendar } from "./trial-calendar";

type Key = "firstName" | "lastName" | "email" | "message" | "trialDates" | "acceptPrivacy";
type Errors = Partial<Record<Key, string>>;

export function JoinRequestForm() {
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [wantsTrial, setWantsTrial] = useState(false);
  const [trialDates, setTrialDates] = useState<string[]>([]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "").trim();
    const values = {
      firstName: text("firstName"),
      lastName: text("lastName"),
      email: text("email"),
      phone: text("phone"),
      message: text("message"),
      wantsTrial,
      acceptPrivacy: data.get("acceptPrivacy") === "on",
      // Honeypot: a person never fills it. Sent as is so a bot gets the same answer.
      website: String(data.get("website") ?? ""),
    };
    const next: Errors = {};
    if (!values.firstName) next.firstName = "Indiquez votre prénom.";
    if (!values.lastName) next.lastName = "Indiquez votre nom.";
    if (!/^\S+@\S+\.\S+$/.test(values.email)) next.email = "Indiquez une adresse e-mail valide.";
    if (values.message.length < 10) next.message = "Présentez-vous en quelques mots (10 caractères minimum).";
    if (wantsTrial && trialDates.length === 0) next.trialDates = "Choisissez au moins un soir pour votre cours d'essai.";
    if (!values.acceptPrivacy) next.acceptPrivacy = "Votre accord est nécessaire pour que le dojo vous recontacte.";
    setErrors(next);
    setError(null);
    if (Object.keys(next).length > 0) return;

    const { phone, website, ...rest } = values;
    setPending(true);
    const result = await apiRequest("POST", "/join-requests", {
      ...rest,
      acceptPrivacy: true,
      ...(wantsTrial && { trialDates }),
      ...(phone && { phone }),
      ...(website && { website }),
    });
    setPending(false);
    if (!result.ok) {
      if (result.code === "invalid_trial_dates") return setErrors({ trialDates: result.error });
      return setError(
        result.status === 429
          ? "Vous avez déjà envoyé plusieurs demandes. Le bureau vous répondra : patientez une heure avant de réessayer."
          : result.error,
      );
    }
    setDone(true);
  }

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <p className="font-serif text-lg font-semibold text-ink">Merci, votre message a bien été envoyé au bureau du dojo.</p>
        <p className="text-sm text-muted">
          Vous allez recevoir un accusé de réception par e-mail. Un membre du bureau vous répondra rapidement et, si
          vous rejoignez le dojo, vous enverra un lien pour créer votre compte.
        </p>
        <Link href="/" className="text-sm font-medium text-accent hover:underline">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="Prénom" error={errors.firstName}>
          {(control) => <Input {...control} name="firstName" autoComplete="given-name" maxLength={80} required />}
        </Field>
        <Field id="lastName" label="Nom" error={errors.lastName}>
          {(control) => <Input {...control} name="lastName" autoComplete="family-name" maxLength={80} required />}
        </Field>
      </div>
      <Field id="email" label="Adresse e-mail" error={errors.email}>
        {(control) => <Input {...control} name="email" type="email" autoComplete="email" maxLength={254} required />}
      </Field>
      <Field id="phone" label="Téléphone (facultatif)">
        {(control) => <Input {...control} name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} />}
      </Field>
      <Field
        id="message"
        label="Votre message"
        hint="Votre expérience des arts martiaux, vos disponibilités, vos questions."
        error={errors.message}
      >
        {(control) => <Textarea {...control} name="message" rows={5} minLength={10} maxLength={2000} required />}
      </Field>
      {/* Honeypot: off screen and out of the tab order, invisible to people and assistive tech. */}
      <div aria-hidden className="absolute -left-2500 h-px w-px overflow-hidden">
        <label htmlFor="website">Site web</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <input
            id="wantsTrial"
            name="wantsTrial"
            type="checkbox"
            checked={wantsTrial}
            onChange={(event) => setWantsTrial(event.target.checked)}
            aria-controls="trial-dates"
            className="mt-0.5 size-4 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <label htmlFor="wantsTrial" className="text-sm text-ink">
            Je souhaite faire un cours d&apos;essai
          </label>
        </div>
        {wantsTrial && (
          <fieldset id="trial-dates" className="flex flex-col gap-3">
            <legend className="sr-only">Soirs pour le cours d&apos;essai</legend>
            <p id="trial-dates-hint" className="text-sm text-muted">
              Le dojo est ouvert le lundi, le mercredi et le vendredi soir. Choisissez les soirs où vous pouvez venir : le
              bureau vous confirmera la date et l&apos;heure.
            </p>
            <TrialCalendar
              value={trialDates}
              onChange={setTrialDates}
              describedBy={errors.trialDates ? "trial-dates-hint trial-dates-error" : "trial-dates-hint"}
            />
            {errors.trialDates && (
              <p id="trial-dates-error" className="text-xs font-medium text-danger">
                {errors.trialDates}
              </p>
            )}
          </fieldset>
        )}
      </div>
      <ConsentCheckbox id="acceptPrivacy" error={errors.acceptPrivacy}>
        J&apos;accepte que le Shobukan Dojo conserve ces informations pour répondre à ma demande (
        <Link href="/confidentialite" target="_blank" rel="noopener" className="font-medium text-accent underline underline-offset-2">
          politique de confidentialité, nouvel onglet
        </Link>).
      </ConsentCheckbox>
      <Button type="submit" loading={pending} className="mt-2 w-full">
        Envoyer ma demande
      </Button>
      <p className="text-center text-sm text-muted">
        Vous pratiquez déjà au dojo ?{" "}
        <Link href="/activation" className="font-medium text-accent hover:underline">
          Activer mon compte
        </Link>
      </p>
    </form>
  );
}
