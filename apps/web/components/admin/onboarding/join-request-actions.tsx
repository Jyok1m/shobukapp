"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { notifyJoinRequestsChanged } from "@/components/shell/use-join-request-count";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/client-api";
import { emailTakenAdmin } from "@/lib/onboarding";
import type { JoinRequest, LinkInvitationResult } from "@/lib/types";
import { DeliveryPanel } from "./delivery-panel";

type Dialog = "invite" | "delete" | null;

export function JoinRequestActions({ request }: { request: JoinRequest }) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, setPending] = useState<"invite" | "status" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [link, setLink] = useState<LinkInvitationResult | null>(null);

  const alreadyInvited = request.invitation !== null;

  async function invite() {
    setPending("invite");
    setError(null);
    setDialogError(null);
    const result = await apiRequest<LinkInvitationResult>("POST", `/admin/join-requests/${request.id}/invite`);
    setPending(null);
    if (!result.ok) {
      const message = result.code === "email_taken" ? emailTakenAdmin : result.error;
      if (dialog) return setDialogError(message);
      return setError(message);
    }
    setDialog(null);
    setLink(result.data);
    notifyJoinRequestsChanged();
    router.refresh();
  }

  async function setStatus(status: "NEW" | "DECLINED") {
    setPending("status");
    setError(null);
    const result = await apiRequest("PATCH", `/admin/join-requests/${request.id}`, { status });
    setPending(null);
    if (!result.ok) return setError(result.error);
    toast.success(status === "DECLINED" ? "Demande déclinée" : "Demande remise à traiter");
    notifyJoinRequestsChanged();
    router.refresh();
  }

  async function remove() {
    setPending("delete");
    setDialogError(null);
    const result = await apiRequest("DELETE", `/admin/join-requests/${request.id}`);
    if (!result.ok) {
      setPending(null);
      return setDialogError(result.error);
    }
    toast.success("Demande supprimée");
    notifyJoinRequestsChanged();
    router.replace("/admin/demandes");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          loading={pending === "invite" && dialog === null}
          disabled={pending !== null}
          onClick={() => {
            setDialogError(null);
            if (alreadyInvited) setDialog("invite");
            else void invite();
          }}
        >
          {alreadyInvited ? "Renvoyer un lien" : "Envoyer un lien d'inscription"}
        </Button>
        {request.status === "DECLINED" ? (
          <Button variant="secondary" loading={pending === "status"} disabled={pending !== null} onClick={() => setStatus("NEW")}>
            Remettre en attente
          </Button>
        ) : (
          request.status === "NEW" && (
            <Button
              variant="secondary"
              loading={pending === "status"}
              disabled={pending !== null}
              onClick={() => setStatus("DECLINED")}
            >
              Refuser
            </Button>
          )
        )}
        <Button
          variant="ghost-danger"
          disabled={pending !== null}
          onClick={() => {
            setDialogError(null);
            setDialog("delete");
          }}
        >
          Supprimer la demande
        </Button>
      </div>
      <FormAlert message={error} />
      {link && <DeliveryPanel kind="link" value={link.link} expiresAt={link.expiresAt} delivery={link.delivery} />}

      <ConfirmDialog
        open={dialog === "invite"}
        title="Renvoyer un lien d'inscription ?"
        description="Un nouveau lien est créé et envoyé. Le lien précédent cesse de fonctionner immédiatement."
        confirmLabel="Renvoyer un lien"
        confirmVariant="primary"
        pending={pending === "invite"}
        error={dialogError}
        onConfirm={invite}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        title="Supprimer cette demande ?"
        description="La demande et les coordonnées de cette personne sont définitivement effacées. Cette action est irréversible."
        confirmLabel="Supprimer définitivement"
        pending={pending === "delete"}
        error={dialogError}
        onConfirm={remove}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
