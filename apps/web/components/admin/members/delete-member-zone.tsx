"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/client-api";

/* Case and surrounding spaces do not matter: the typed name is a safety catch, not a secret. */
function sameName(a: string, b: string): boolean {
  return a.trim().localeCompare(b.trim(), "fr", { sensitivity: "base" }) === 0;
}

export function DeleteMemberZone({ memberId, firstName, lastName }: { memberId: string; firstName: string; lastName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!sameName(typed, lastName)) return;
    setPending(true);
    setError(null);
    const result = await apiRequest("DELETE", `/admin/members/${memberId}`);
    if (!result.ok) {
      setPending(false);
      return setError(result.error);
    }
    router.replace("/admin/membres");
    router.refresh();
  }

  return (
    <section
      aria-labelledby="danger-zone-title"
      className="rounded-lg border border-danger/30 bg-surface p-5 sm:p-6"
    >
      <h2 id="danger-zone-title" className="font-serif text-lg font-semibold text-danger">
        Zone de danger
      </h2>
      <p className="mt-1 text-sm text-muted">
        La suppression efface définitivement le compte, le profil, les documents, les messages envoyés et
        l&apos;historique du membre. Sa cotisation est résiliée immédiatement chez Stripe. Les factures restent chez Stripe,
        comme la loi l&apos;exige.
      </p>
      <Button
        variant="danger"
        className="mt-4"
        onClick={() => {
          setTyped("");
          setError(null);
          setOpen(true);
        }}
      >
        Supprimer ce membre
      </Button>

      <ConfirmDialog
        open={open}
        title={`Supprimer ${firstName} ${lastName} ?`}
        description="Cette action est irréversible. La cotisation Stripe du membre est résiliée immédiatement, puis ses fichiers et ses données sont effacés."
        confirmLabel="Supprimer définitivement"
        pending={pending}
        error={error}
        confirmDisabled={!sameName(typed, lastName)}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      >
        <Field id="confirm-last-name" label={`Pour confirmer, saisissez le nom du membre : ${lastName}`}>
          {(control) => (
            <Input
              {...control}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              disabled={pending}
            />
          )}
        </Field>
      </ConfirmDialog>
    </section>
  );
}
