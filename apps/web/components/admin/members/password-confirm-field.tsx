"use client";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/* The acting admin re-enters their own password before a sensitive change. */
export function PasswordConfirmField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field id={id} label="Votre mot de passe" hint="Celui de votre propre compte, pour confirmer que c'est bien vous.">
      {(control) => (
        <Input
          {...control}
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          maxLength={128}
        />
      )}
    </Field>
  );
}
