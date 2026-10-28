"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/client-api";
import type { SelfUser } from "@/lib/types";

/* Exactly the keys PATCH /me accepts besides directoryVisible: unknown keys are a 400. */
const textKeys = [
  "firstName",
  "lastName",
  "phone",
  "birthDate",
  "sex",
  "nationality",
  "addressLine",
  "postalCode",
  "city",
  "country",
  "emergencyContactName",
  "emergencyContactPhone",
] as const;

type TextKey = (typeof textKeys)[number];
type FieldErrors = Partial<Record<TextKey, string>>;

function TextField({
  name,
  label,
  defaultValue,
  error,
  hint,
  className,
  ...input
}: {
  name: TextKey;
  label: ReactNode;
  defaultValue: string | null;
  error?: string;
  hint?: ReactNode;
  className?: string;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  required?: boolean;
  inputMode?: "tel" | "text";
}) {
  return (
    <Field id={name} label={label} error={error} hint={hint} className={className}>
      {(control) => <Input {...control} {...input} name={name} defaultValue={defaultValue ?? ""} />}
    </Field>
  );
}

/* Copy for the member's own profile and for an admin editing someone else's. */
const copy = {
  self: {
    identity: "Votre adresse e-mail ne peut pas être modifiée ici.",
    licence:
      "Nécessaires pour établir votre licence FFJDA : complétez-les avant votre demande de licence. Visibles uniquement par vous et les administrateurs du dojo.",
    firstNameRequired: "Indiquez votre prénom.",
    lastNameRequired: "Indiquez votre nom.",
    submit: "Enregistrer mon profil",
  },
  admin: {
    identity: "L'adresse e-mail et le mot de passe restent gérés par le membre.",
    licence: "Nécessaires pour établir la licence FFJDA. Visibles uniquement par le membre et les administrateurs du dojo.",
    firstNameRequired: "Indiquez le prénom.",
    lastNameRequired: "Indiquez le nom.",
    submit: "Enregistrer le profil",
  },
};

/* Without memberId: PATCH /me. With memberId: PATCH /admin/members/:id (same body). */
export function ProfileForm({ user, memberId }: { user: SelfUser; memberId?: string }) {
  const text = memberId ? copy.admin : copy.self;
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // An empty string clears an optional field on the API side.
    const payload = Object.fromEntries(textKeys.map((key) => [key, String(data.get(key) ?? "").trim()])) as Record<
      TextKey,
      string
    >;

    const errors: FieldErrors = {};
    if (!payload.firstName) errors.firstName = text.firstNameRequired;
    if (!payload.lastName) errors.lastName = text.lastNameRequired;
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    const result = await apiRequest<SelfUser>("PATCH", memberId ? `/admin/members/${memberId}` : "/me", payload);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(memberId ? "Fiche du membre enregistrée" : "Profil enregistré");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <Card title="Identité et coordonnées" description={text.identity}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="firstName"
            label="Prénom"
            defaultValue={user.firstName}
            error={fieldErrors.firstName}
            autoComplete="given-name"
            maxLength={80}
            required
          />
          <TextField
            name="lastName"
            label="Nom"
            defaultValue={user.lastName}
            error={fieldErrors.lastName}
            autoComplete="family-name"
            maxLength={80}
            required
          />
          <Field id="email" label="Adresse e-mail">
            {(control) => <Input {...control} value={user.email} readOnly disabled />}
          </Field>
          <TextField
            name="phone"
            label="Téléphone"
            defaultValue={user.phone}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
          />
        </div>
      </Card>

      <Card
        title="Informations pour la licence FFJDA"
        description={text.licence}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="birthDate"
            label="Date de naissance"
            defaultValue={user.birthDate ? user.birthDate.slice(0, 10) : null}
            type="date"
            autoComplete="bday"
          />
          <Field id="sex" label="Sexe">
            {(control) => (
              <Select {...control} name="sex" defaultValue={user.sex ?? ""}>
                <option value="">Non renseigné</option>
                <option value="FEMALE">Femme</option>
                <option value="MALE">Homme</option>
              </Select>
            )}
          </Field>
          <TextField name="nationality" label="Nationalité" defaultValue={user.nationality} maxLength={60} />
          <TextField
            name="addressLine"
            label="Adresse"
            defaultValue={user.addressLine}
            autoComplete="street-address"
            maxLength={200}
            className="sm:col-span-2"
          />
          <TextField
            name="postalCode"
            label="Code postal"
            defaultValue={user.postalCode}
            autoComplete="postal-code"
            maxLength={20}
          />
          <TextField
            name="city"
            label="Ville"
            defaultValue={user.city}
            autoComplete="address-level2"
            maxLength={100}
          />
          <TextField
            name="country"
            label="Pays"
            defaultValue={user.country}
            autoComplete="country-name"
            maxLength={60}
          />
        </div>
        <h3 className="mt-6 mb-3 text-sm font-semibold text-ink">Personne à prévenir en cas d&apos;urgence</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="emergencyContactName"
            label="Nom et prénom"
            defaultValue={user.emergencyContactName}
            maxLength={120}
          />
          <TextField
            name="emergencyContactPhone"
            label="Téléphone"
            defaultValue={user.emergencyContactPhone}
            type="tel"
            inputMode="tel"
            maxLength={30}
          />
        </div>
      </Card>

      <Button type="submit" loading={pending} className="self-start">
        {text.submit}
      </Button>
      <FormAlert message={error} />
    </form>
  );
}
