import type { BadgeTone } from "@/components/ui/badge";
import type { Frequency, PaymentStatus, SelfUser } from "./types";

/* "250 €" for whole amounts, "15,50 €" otherwise. */
export function formatAmount(amountCents: number, currency: string): string {
  const whole = amountCents % 100 === 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(new Date(value));
}

export function formatShortDate(value: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" }).format(new Date(value));
}

export const FREQUENCIES: Frequency[] = ["YEAR", "QUARTER", "MONTH"];

/* "250 € par an" */
export const frequencyUnits: Record<Frequency, string> = {
  YEAR: "par an",
  QUARTER: "par trimestre",
  MONTH: "par mois",
};

/* "250 € / an", compact lists. */
export const frequencyShortUnits: Record<Frequency, string> = {
  YEAR: "an",
  QUARTER: "trimestre",
  MONTH: "mois",
};

/* Frequency names: admin form rows and the member's checkout. */
export const frequencyNames: Record<Frequency, string> = {
  YEAR: "Annuel",
  QUARTER: "Trimestriel",
  MONTH: "Mensuel",
};

/* Agrees with "cotisation": "Adulte · trimestrielle". */
export const frequencyAdjectives: Record<Frequency, string> = {
  YEAR: "annuelle",
  QUARTER: "trimestrielle",
  MONTH: "mensuelle",
};

export const paymentsPerYear: Record<Frequency, number> = { YEAR: 1, QUARTER: 4, MONTH: 12 };

/* "Adulte · trimestrielle", or the plan alone when the frequency is unknown. */
export function cotisationLabel(planName: string | null, frequency: Frequency | null): string | null {
  if (!planName) return null;
  return frequency ? `${planName} · ${frequencyAdjectives[frequency]}` : planName;
}

/* "250 € / an · 70 € / trimestre · 25 € / mois" */
export function formatPrices(prices: { frequency: Frequency; amountCents: number }[], currency: string): string {
  return prices.map((price) => `${formatAmount(price.amountCents, currency)} / ${frequencyShortUnits[price.frequency]}`).join(" · ");
}

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
  if (!status) return { label: "Sans cotisation", tone: "neutral" };
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
