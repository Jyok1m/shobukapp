"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/client-api";

export function DirectoryToggle({ visible }: { visible: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [checked, setChecked] = useState(visible);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(next: boolean) {
    setChecked(next);
    setPending(true);
    setError(null);
    const result = await apiRequest("PATCH", "/me", { directoryVisible: next });
    setPending(false);
    if (!result.ok) {
      setChecked(!next);
      setError(result.error);
      return;
    }
    toast.success(next ? "Vous apparaissez dans l'annuaire" : "Vous n'apparaissez plus dans l'annuaire");
    router.refresh();
  }

  return (
    <Card title="Annuaire des membres">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <input
            id="directoryVisible"
            type="checkbox"
            checked={checked}
            disabled={pending}
            onChange={(event) => onChange(event.target.checked)}
            aria-describedby="directoryVisible-hint"
            className="mt-0.5 size-4 shrink-0 accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <label htmlFor="directoryVisible" className="text-sm font-medium text-ink">
            Apparaître dans l&apos;annuaire des membres
          </label>
        </div>
        <div id="directoryVisible-hint" className="flex flex-col gap-2 text-sm text-muted">
          <p>
            Les membres connectés verront votre <strong className="font-medium text-ink">nom</strong>, votre{" "}
            <strong className="font-medium text-ink">photo</strong>, votre{" "}
            <strong className="font-medium text-ink">téléphone</strong> et votre{" "}
            <strong className="font-medium text-ink">adresse e-mail</strong>, et pourront vous écrire.
          </p>
          <p>
            Jamais votre date de naissance, votre adresse, votre contact d&apos;urgence, vos documents ni vos
            paiements. Vous pouvez vous retirer à tout moment ; votre photo peut rester visible quelques minutes
            dans le navigateur d&apos;un membre qui l&apos;a déjà affichée.
          </p>
        </div>
        <p className="text-sm" aria-live="polite">
          {checked ? "Vous êtes visible dans l'annuaire." : "Vous n'apparaissez pas dans l'annuaire."}
        </p>
        <FormAlert message={error} />
      </div>
    </Card>
  );
}
