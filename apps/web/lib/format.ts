import type { BadgeTone } from "@/components/ui/badge";
import type { PaymentStatus, PlanInterval, SelfUser } from "./types";

export function formatAmount(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase() }).format(
    amountCents / 100,
  );
}

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(value));
}

export function formatShortDate(value: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" }).format(new Date(value));
}

export const intervalLabels: Record<PlanInterval, string> = {
  MONTH: "par mois",
  YEAR: "par an",
};

export const intervalNames: Record<PlanInterval, string> = {
  MONTH: "Mensuelle",
  YEAR: "Annuelle",
};

/* Stripe subscription statuses, in French (docs/design.md). */
const membershipStatuses: Record<string, { label: string; tone: BadgeTone }> = {
  active: { label: "Actif", tone: "success" },
  trialing: { label: "Période d'essai", tone: "success" },
  past_due: { label: "En retard de paiement", tone: "danger" },
  unpaid: { label: "Impayé", tone: "danger" },
  canceled: { label: "Résilié", tone: "neutral" },
  incomplete: { label: "Paiement en attente", tone: "accent" },
  incomplete_expired: { label: "Paiement expiré", tone: "neutral" },
  paused: { label: "Suspendu", tone: "neutral" },
};

export function membershipStatus(status: string | null): { label: string; tone: BadgeTone } {
  if (!status) return { label: "Sans abonnement", tone: "neutral" };
  return membershipStatuses[status] ?? { label: "Statut inconnu", tone: "neutral" };
}

export const paymentStatuses: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  PAID: { label: "Payé", tone: "success" },
  FAILED: { label: "Échoué", tone: "danger" },
  OPEN: { label: "En attente", tone: "accent" },
};

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/* Fields the FFK licence and the dojo need. Drives the dashboard hint. */
const profileFields = [
  "phone",
  "photoKey",
  "birthDate",
  "sex",
  "nationality",
  "addressLine",
  "postalCode",
  "city",
  "country",
  "emergencyContactName",
  "emergencyContactPhone",
] as const satisfies ReadonlyArray<keyof SelfUser>;

export function profileCompleteness(user: SelfUser): { filled: number; total: number } {
  const filled = profileFields.filter((field) => Boolean(user[field])).length;
  return { filled, total: profileFields.length };
}
