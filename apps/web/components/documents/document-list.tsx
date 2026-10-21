"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { apiRequest } from "@/lib/client-api";
import { categoryLabels, certificateState, formatBytes } from "@/lib/documents";
import { formatShortDate } from "@/lib/format";
import type { MemberDocument } from "@/lib/types";
import { DocumentEditDialog } from "./document-edit-dialog";

function Validity({ document }: { document: MemberDocument }) {
  if (document.category !== "MEDICAL_CERTIFICATE") return <span className="text-muted">Sans objet</span>;
  const state = certificateState(document);
  return <Badge tone={state.tone}>{state.label}</Badge>;
}

/*
 * Downloads are plain links: same origin, the session cookie goes with them and
 * the API answers with an attachment. Without `editable`, the list is read-only.
 */
export function DocumentList({
  documents,
  editable = false,
  showCategory = true,
  showValidity = true,
  caption,
  emptyTitle,
  emptyDescription,
}: {
  documents: MemberDocument[];
  editable?: boolean;
  showCategory?: boolean;
  showValidity?: boolean;
  caption: string;
  emptyTitle: string;
  emptyDescription?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<MemberDocument | null>(null);
  const [deleting, setDeleting] = useState<MemberDocument | null>(null);
  const [pending, setPending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function remove() {
    if (!deleting) return;
    setPending(true);
    setDeleteError(null);
    const result = await apiRequest("DELETE", `/documents/${deleting.id}`);
    setPending(false);
    if (!result.ok) return setDeleteError(result.error);
    setDeleting(null);
    router.refresh();
  }

  if (documents.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <Th>Document</Th>
            {showCategory && <Th>Type</Th>}
            {showValidity && <Th>Validité</Th>}
            <Th>Ajouté le</Th>
            <Th>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => {
            const expired =
              document.category === "MEDICAL_CERTIFICATE" && certificateState(document).tone === "danger";
            return (
              <tr key={document.id} className={expired ? "bg-danger-soft/40" : undefined}>
                <Td className="min-w-48">
                  <p className="font-medium break-words">{document.title}</p>
                  <p className="text-xs text-muted">{formatBytes(document.sizeBytes)}</p>
                </Td>
                {showCategory && <Td className="whitespace-nowrap">{categoryLabels[document.category]}</Td>}
                {showValidity && (
                  <Td className="whitespace-nowrap">
                    <Validity document={document} />
                  </Td>
                )}
                <Td className="whitespace-nowrap">{formatShortDate(document.createdAt)}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <a
                      href={`/api/documents/${document.id}/file`}
                      download
                      className="inline-flex h-8 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-accent hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-accent"
                      aria-label={`Télécharger ${document.title}`}
                    >
                      Télécharger
                    </a>
                    {editable && (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => setEditing(document)}>
                          Modifier
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(document);
                          }}
                        >
                          Supprimer
                        </Button>
                      </>
                    )}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {editable && (
        <>
          <DocumentEditDialog
            document={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              router.refresh();
            }}
          />
          <ConfirmDialog
            open={deleting !== null}
            title={deleting ? `Supprimer « ${deleting.title} » ?` : "Supprimer le document ?"}
            description="Le document et son fichier seront définitivement supprimés."
            confirmLabel="Supprimer"
            pending={pending}
            error={deleteError}
            onConfirm={remove}
            onCancel={() => setDeleting(null)}
          />
        </>
      )}
    </div>
  );
}
