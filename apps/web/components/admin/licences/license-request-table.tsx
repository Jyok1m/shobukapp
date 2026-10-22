"use client";

import Link from "next/link";
import { useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Table, Td, Th } from "@/components/ui/table";
import { apiRequest } from "@/lib/client-api";
import { DISCIPLINE_LABELS } from "@/lib/documents";
import { formatShortDate } from "@/lib/format";
import { licenseRequestStatuses, missingFieldsText } from "@/lib/license-requests";
import type { LicenseRequest } from "@/lib/types";

function requestLabel(request: LicenseRequest, showMember: boolean): string {
  const base = `${DISCIPLINE_LABELS[request.discipline]} ${request.season}`;
  return showMember ? `${base} de ${request.member.firstName} ${request.member.lastName}` : base;
}

/*
 * Requests with their status actions. The owner decides how a change shows up:
 * the paginated admin list patches its own state, the member card refreshes the page.
 */
export function LicenseRequestTable({
  items,
  caption,
  showMember,
  onUpdated,
  onDeleted,
}: {
  items: LicenseRequest[];
  caption: string;
  showMember: boolean;
  onUpdated: (request: LicenseRequest) => void;
  onDeleted: (id: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<LicenseRequest | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function setStatus(request: LicenseRequest, status: "PENDING" | "SENT") {
    setBusyId(request.id);
    setRowError(null);
    const result = await apiRequest<LicenseRequest>("PATCH", `/admin/license-requests/${request.id}`, { status });
    setBusyId(null);
    if (!result.ok) return setRowError(result.error);
    onUpdated(result.data);
  }

  async function remove() {
    if (!deleting) return;
    setDeletePending(true);
    setDeleteError(null);
    const result = await apiRequest("DELETE", `/admin/license-requests/${deleting.id}`);
    setDeletePending(false);
    if (!result.ok) return setDeleteError(result.error);
    onDeleted(deleting.id);
    setDeleting(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <FormAlert message={rowError} />
      <Table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {showMember ? <Th>Membre</Th> : <Th>Saison</Th>}
            <Th>Discipline</Th>
            <Th>Statut</Th>
            <Th>Note</Th>
            <Th>Créée le</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {items.map((request) => {
            const status = licenseRequestStatuses[request.status];
            const missing = showMember && request.status !== "DONE" ? missingFieldsText(request.missingFields) : null;
            const busy = busyId === request.id;
            const label = requestLabel(request, showMember);
            return (
              <tr key={request.id}>
                {showMember ? (
                  <Td className="min-w-48">
                    <div className="flex flex-col gap-1">
                      <Link href={`/admin/membres/${request.member.id}`} className="font-medium text-accent hover:underline">
                        {request.member.firstName} {request.member.lastName}
                      </Link>
                      {missing && <span className="text-xs font-medium text-warning">{missing}</span>}
                    </div>
                  </Td>
                ) : (
                  <Td className="font-medium whitespace-nowrap">{request.season}</Td>
                )}
                <Td>{DISCIPLINE_LABELS[request.discipline]}</Td>
                <Td>
                  <Badge tone={status.tone} className="whitespace-nowrap">
                    {status.label}
                  </Badge>
                </Td>
                <Td className="min-w-40 whitespace-pre-line text-muted">{request.note ?? ""}</Td>
                <Td className="whitespace-nowrap">{formatShortDate(request.createdAt)}</Td>
                <Td>
                  <div className="flex items-center justify-end gap-2">
                    {request.status === "PENDING" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="whitespace-nowrap"
                        loading={busy}
                        onClick={() => setStatus(request, "SENT")}
                        aria-label={`Marquer envoyée la demande ${label}`}
                      >
                        Marquer envoyée
                      </Button>
                    )}
                    {request.status === "SENT" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="whitespace-nowrap"
                        loading={busy}
                        onClick={() => setStatus(request, "PENDING")}
                        aria-label={`Remettre à faire la demande ${label}`}
                      >
                        Remettre à faire
                      </Button>
                    )}
                    <Button
                      variant="ghost-danger"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(request);
                      }}
                      aria-label={`Supprimer la demande ${label}`}
                    >
                      Supprimer
                    </Button>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `Supprimer la demande ${requestLabel(deleting, showMember)} ?` : "Supprimer la demande ?"}
        description="La demande disparaît du suivi. Une licence déjà déposée n'est pas touchée."
        confirmLabel="Supprimer"
        pending={deletePending}
        error={deleteError}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
