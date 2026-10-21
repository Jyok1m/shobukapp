"use client";

import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/client-api";
import type { MemberDocument } from "@/lib/types";

/* PATCH /documents/:id: the title, and the validity date of a medical certificate. */
export function DocumentEditDialog({
  document,
  onClose,
  onSaved,
}: {
  document: MemberDocument | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const withValidity = document?.category === "MEDICAL_CERTIFICATE";

  function close() {
    setError(null);
    setTitleError(null);
    onClose();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!document) return;
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") ?? "").trim();
    if (!title) return setTitleError("Donnez un titre au document.");
    setTitleError(null);
    const body: { title: string; validUntil?: string } = { title };
    // An empty string clears the date on the API side.
    if (withValidity) body.validUntil = String(data.get("validUntil") ?? "");
    setPending(true);
    setError(null);
    const result = await apiRequest("PATCH", `/documents/${document.id}`, body);
    setPending(false);
    if (!result.ok) return setError(result.error);
    onSaved();
  }

  return (
    <Dialog open={document !== null} title="Modifier le document" dismissible={!pending} onClose={close}>
      {document && (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field id="edit-document-title" label="Titre" error={titleError}>
            {(control) => <Input {...control} name="title" defaultValue={document.title} maxLength={120} />}
          </Field>
          {withValidity && (
            <Field id="edit-document-valid-until" label="Valable jusqu'au">
              {(control) => (
                <Input
                  {...control}
                  name="validUntil"
                  type="date"
                  defaultValue={document.validUntil ? document.validUntil.slice(0, 10) : ""}
                />
              )}
            </Field>
          )}
          <FormAlert message={error} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={close} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              Enregistrer
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
