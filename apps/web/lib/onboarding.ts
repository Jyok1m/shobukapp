import type { BadgeTone } from "@/components/ui/badge";
import type { InvitationKind, InvitationStatus, JoinRequestStatus, MailDelivery } from "./types";

export const joinRequestStatuses: Record<JoinRequestStatus, { label: string; tone: BadgeTone }> = {
  NEW: { label: "Nouvelle", tone: "accent" },
  INVITED: { label: "Invitée", tone: "success" },
  DECLINED: { label: "Refusée", tone: "neutral" },
};

export const invitationStatuses: Record<InvitationStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "En attente", tone: "accent" },
  USED: { label: "Utilisée", tone: "success" },
  REVOKED: { label: "Révoquée", tone: "neutral" },
  EXPIRED: { label: "Expirée", tone: "neutral" },
  LOCKED: { label: "Bloquée", tone: "danger" },
};

export const invitationKinds: Record<InvitationKind, string> = {
  LINK: "Lien",
  CODE: "Code",
};

/* What the admin must do when the mail did not leave. */
export function deliveryMessage(delivery: MailDelivery, what: "le lien" | "le code"): { text: string; ok: boolean } {
  if (delivery === "sent") return { text: `E-mail envoyé. Vous pouvez aussi transmettre ${what} vous-même.`, ok: true };
  if (delivery === "logged") {
    return {
      text: `E-mail non envoyé : aucun serveur d'envoi configuré, transmettez ${what} vous-même.`,
      ok: false,
    };
  }
  return { text: `L'envoi a échoué, transmettez ${what} vous-même.`, ok: false };
}

/* Shown by the admin screens on a 409: their wording differs from the signup one. */
export const emailTakenAdmin = "Cette adresse a déjà un compte.";
