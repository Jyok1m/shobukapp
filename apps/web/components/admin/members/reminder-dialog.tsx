"use client";

import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ToastInput } from "@/components/ui/toast";
import { apiRequest } from "@/lib/client-api";
import type { ReminderResult } from "@/lib/types";

export type ReminderTarget = { id: string; name: string };

/* Toast after a reminder: a warning when no mail could leave. */
export function reminderToast(result: ReminderResult, name: string): ToastInput {
  return result.delivery === "sent"
    ? { tone: "success", title: `Relance envoyée par e-mail à ${name}` }
    : {
        tone: "warning",
        title: "Relance enregistrée, e-mail non envoyé",
        description: "Aucun serveur d'envoi n'est configuré : prévenez le membre vous-même.",
      };
}

/* POST /admin/members/:id/reminders: a French e-mail with a link to /cotisation, plus a history row. */
export function ReminderDialog({
  target,
  onClose,
  onSent,
}: {
  target: ReminderTarget | null;
  onClose: () => void;
  onSent: (result: ReminderResult, target: ReminderTarget) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setError(null);
    onClose();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target) return;
    const note = String(new FormData(event.currentTarget).get("note") ?? "").trim();
    setPending(true);
    setError(null);
    const result = await apiRequest<ReminderResult>(
      "POST",
      `/admin/members/${target.id}/reminders`,
      note ? { note } : {},
    );
    setPending(false);
    if (!result.ok) return setError(result.error);
    onSent(result.data, target);
  }

  return (
    <Dialog
      open={target !== null}
      title={target ? `Relancer ${target.name}` : "Relancer"}
      description="Un e-mail rappelle que la cotisation n'est pas à jour, avec un lien vers la page « Ma cotisation ». La relance est conservée dans l'historique du membre."
      dismissible={!pending}
      onClose={close}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field id="reminder-note" label="Message personnel (facultatif)" hint="Ajouté à la fin de l'e-mail. 1000 caractères maximum.">
          {(control) => <Textarea {...control} name="note" maxLength={1000} rows={4} />}
        </Field>
        <FormAlert message={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close} disabled={pending}>
            Annuler
          </Button>
          <Button type="submit" loading={pending}>
            Envoyer la relance
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
