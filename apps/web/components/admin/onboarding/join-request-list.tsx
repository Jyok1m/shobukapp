"use client";

import Link from "next/link";
import { useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { apiRequest } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import { joinRequestStatuses } from "@/lib/onboarding";
import type { JoinRequestsPage, JoinRequestStatus } from "@/lib/types";
import { joinRequestsPath } from "./join-request-filters";

const emptyCopy: Record<string, string> = {
  NEW: "Aucune nouvelle demande. Les messages envoyés depuis « Nous rejoindre » arrivent ici.",
  INVITED: "Aucune demande invitée pour l'instant.",
  DECLINED: "Aucune demande refusée.",
  all: "Aucune demande pour l'instant. Les messages envoyés depuis « Nous rejoindre » arrivent ici.",
};

export function JoinRequestList({ initial, status }: { initial: JoinRequestsPage; status: JoinRequestStatus | null }) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor) return;
    setPending(true);
    setError(null);
    const result = await apiRequest<JoinRequestsPage>("GET", joinRequestsPath(status, cursor));
    setPending(false);
    if (!result.ok) return setError(result.error);
    setItems((current) => [...current, ...result.data.items]);
    setCursor(result.data.nextCursor);
  }

  if (items.length === 0) return <EmptyState title="Aucune demande" description={emptyCopy[status ?? "all"]} />;

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {items.map((request) => {
          const state = joinRequestStatuses[request.status];
          return (
            <li key={request.id}>
              <Link
                href={`/admin/demandes/${request.id}`}
                className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 shadow-xs transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">
                    {request.firstName} {request.lastName}
                  </span>
                  <Badge tone={state.tone}>{state.label}</Badge>
                  {request.wantsTrial && <Badge tone="success">Cours d&apos;essai</Badge>}
                  <span className="ml-auto text-xs text-muted">{formatDate(request.createdAt)}</span>
                </div>
                <p className="line-clamp-2 text-sm whitespace-pre-line text-muted">{request.message}</p>
              </Link>
            </li>
          );
        })}
      </ul>
      <FormAlert message={error} />
      {cursor && (
        <Button variant="secondary" loading={pending} onClick={loadMore} className="self-center">
          Charger plus
        </Button>
      )}
    </div>
  );
}
