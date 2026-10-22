"use client";

import { useState, type FormEvent } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/client-api";
import type { MemberDocument, Placement } from "@/lib/types";
import { PlacementFields } from "./placement-fields";

/* PATCH /documents/:id {placement, description}: publish, move or unpublish a dojo document. */
export function DocumentPlacementDialog({
  document,
  onClose,
  onSaved,
}: {
  document: MemberDocument | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={document !== null} title="Affichage du document" onClose={onClose} size="lg">
      {document && <PlacementForm key={document.id} document={document} onClose={onClose} onSaved={onSaved} />}
    </Dialog>
  );
}

function PlacementForm({ document, onClose, onSaved }: { document: MemberDocument; onClose: () => void; onSaved: () => void }) {
  const [placement, setPlacement] = useState<Placement>(document.placement ?? "PRIVATE");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const description = String(new FormData(event.currentTarget).get("description") ?? "").trim();
    setPending(true);
    setError(null);
    // An empty description clears it.
    const result = await apiRequest("PATCH", `/documents/${document.id}`, { placement, description });
    setPending(false);
    if (!result.ok) return setError(result.error);
    onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted">{document.title}</p>
      <PlacementFields
        idPrefix={`placement-${document.id}`}
        category={document.category}
        placement={placement}
        onPlacementChange={setPlacement}
        defaultDescription={document.description}
      />
      <FormAlert message={error} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" loading={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
