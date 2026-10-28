"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/client-api";
import { formatShortDate } from "@/lib/format";
import { invitationKinds, invitationStatuses } from "@/lib/onboarding";
import type { Invitation } from "@/lib/types";

export function InvitationsTable({ invitations }: { invitations: Invitation[] }) {
  const router = useRouter();
  const toast = useToast();
  const [revoking, setRevoking] = useState<Invitation | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    if (!revoking) return;
    setPending(true);
    setError(null);
    const result = await apiRequest("DELETE", `/admin/invitations/${revoking.id}`);
    setPending(false);
    if (!result.ok) return setError(result.error);
    toast.success("Invitation révoquée", "Le lien ou le code ne permet plus de créer un compte.");
    setRevoking(null);
    router.refresh();
  }

  if (invitations.length === 0) {
    return (
      <EmptyState
        title="Aucune invitation"
        description="Les liens envoyés depuis les demandes et les codes d'activation apparaîtront ici."
      />
    );
  }

  return (
    <>
      <Table>
        <caption className="sr-only">Invitations envoyées</caption>
        <thead>
          <tr>
            <Th>Type</Th>
            <Th>Personne</Th>
            <Th>Créée par</Th>
            <Th>Expiration</Th>
            <Th>Statut</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((invitation) => {
            const state = invitationStatuses[invitation.status];
            return (
              <tr key={invitation.id}>
                <Td className="whitespace-nowrap">{invitationKinds[invitation.kind]}</Td>
                <Td className="min-w-48">
                  <span className="font-medium">
                    {invitation.firstName} {invitation.lastName}
                  </span>
                  <span className="block text-xs break-all text-muted">{invitation.email}</span>
                  {invitation.joinRequestId && (
                    <Link
                      href={`/admin/demandes/${invitation.joinRequestId}`}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Voir la demande
                    </Link>
                  )}
                </Td>
                <Td className="whitespace-nowrap">
                  {invitation.createdBy ? (
                    `${invitation.createdBy.firstName} ${invitation.createdBy.lastName}`
                  ) : (
                    <span className="text-muted">Compte supprimé</span>
                  )}
                  <span className="block text-xs text-muted">le {formatShortDate(invitation.createdAt)}</span>
                </Td>
                <Td className="whitespace-nowrap">{formatShortDate(invitation.expiresAt)}</Td>
                <Td className="whitespace-nowrap">
                  <Badge tone={state.tone}>{state.label}</Badge>
                </Td>
                <Td>
                  <div className="flex justify-end">
                    {invitation.status === "PENDING" && (
                      <Button
                        variant="ghost-danger"
                        size="sm"
                        onClick={() => {
                          setError(null);
                          setRevoking(invitation);
                        }}
                        aria-label={`Révoquer l'invitation de ${invitation.firstName} ${invitation.lastName}`}
                      >
                        Révoquer
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <ConfirmDialog
        open={revoking !== null}
        title="Révoquer cette invitation ?"
        description={
          revoking
            ? `${revoking.kind === "LINK" ? "Le lien" : "Le code"} envoyé à ${revoking.email} cessera de fonctionner immédiatement.`
            : undefined
        }
        confirmLabel="Révoquer"
        pending={pending}
        error={error}
        onConfirm={revoke}
        onCancel={() => setRevoking(null)}
      />
    </>
  );
}
