"use client";

import { useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { apiRequest } from "@/lib/client-api";
import { licenseRequestsPath } from "@/lib/license-requests";
import type { LicenseRequestStatus, LicenseRequestsPage } from "@/lib/types";
import { LicenseRequestTable } from "./license-request-table";

const emptyCopy: Record<LicenseRequestStatus | "all", string> = {
  PENDING: "Aucune licence à demander pour cette saison. Ajoutez une demande depuis la fiche d'un membre.",
  SENT: "Aucune demande en attente de réponse de la FFJDA pour cette saison.",
  DONE: "Aucune licence reçue pour cette saison.",
  all: "Aucune demande de licence pour cette saison. Ajoutez-en une depuis la fiche d'un membre.",
};

/* A changed row stays in place until the next load, even if it no longer matches the filter. */
export function LicenseRequestList({
  initial,
  season,
  status,
}: {
  initial: LicenseRequestsPage;
  season: string;
  status: LicenseRequestStatus | null;
}) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor) return;
    setPending(true);
    setError(null);
    const result = await apiRequest<LicenseRequestsPage>("GET", licenseRequestsPath({ season, status, cursor }));
    setPending(false);
    if (!result.ok) return setError(result.error);
    setItems((current) => [...current, ...result.data.items]);
    setCursor(result.data.nextCursor);
  }

  if (items.length === 0 && !cursor) return <EmptyState title="Aucune demande" description={emptyCopy[status ?? "all"]} />;

  return (
    <div className="flex flex-col gap-4">
      <LicenseRequestTable
        items={items}
        caption={`Demandes de licence, saison ${season}`}
        showMember
        onUpdated={(updated) => setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)))}
        onDeleted={(id) => setItems((current) => current.filter((item) => item.id !== id))}
      />
      <FormAlert message={error} />
      {cursor && (
        <Button variant="secondary" loading={pending} onClick={loadMore} className="self-center">
          Charger plus
        </Button>
      )}
    </div>
  );
}
