import type { BadgeTone } from "@/components/ui/badge";
import type { ApiResult } from "./client-api";
import type { DocumentCategory, Placement } from "./types";

/* Same limits as the API (docs/documents.md). The API checks the magic bytes again. */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const ACCEPTED_TYPES = DOCUMENT_ACCEPT.split(",");

export const placementLabels: Record<Placement, { label: string; tone: BadgeTone; option: string }> = {
  PRIVATE: { label: "Privé", tone: "neutral", option: "Privé (administrateurs seulement)" },
  ANNOUNCEMENT: { label: "Panneau d'annonces", tone: "accent", option: "Panneau d'annonces" },
  IMPORTANT: { label: "Documents importants", tone: "success", option: "Documents importants" },
};

export const categoryLabels: Record<DocumentCategory, string> = {
  MEDICAL_CERTIFICATE: "Certificat médical",
  LEGAL: "Juridique",
  RULES: "Règlement",
  ACCOUNTING: "Comptabilité",
  OTHER: "Autre",
};

const tooLarge = "Le fichier dépasse la taille maximale de 10 Mo.";
const unsupported = "Format non pris en charge. Utilisez un PDF ou une image JPEG, PNG ou WebP.";

/* Browser side check before the upload: saves sending 10 MB for a refusal. */
export function checkDocumentFile(file: File): string | null {
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) return unsupported;
  if (file.size > DOCUMENT_MAX_BYTES) return tooLarge;
  return null;
}

/* The shared error copy speaks of photos (5 Mo, images only): documents have their own limits. */
export function documentUploadError(result: Extract<ApiResult<unknown>, { ok: false }>): string {
  if (result.code === "file_too_large" || result.status === 413) return tooLarge;
  if (result.code === "unsupported_file_type") return unsupported;
  return result.error;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const format = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
  if (bytes < 1024 * 1024) return `${format(bytes / 1024)} Ko`;
  return `${format(bytes / (1024 * 1024))} Mo`;
}

/* Today in Paris as YYYY-MM-DD (en-CA formats dates that way). */
export function todayInParis(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

/* A certificate is valid through its last day. Dates are compared as YYYY-MM-DD strings. */
export function isExpired(validUntil: string): boolean {
  return validUntil.slice(0, 10) < todayInParis();
}

const shortDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "UTC" });

/* validUntil is a calendar date (midnight UTC): format it in UTC so it never shifts by a day. */
export function formatCalendarDate(value: string): string {
  return shortDate.format(new Date(value));
}

export function certificateState(certificate: { validUntil: string | null } | null): { label: string; tone: BadgeTone } {
  if (!certificate) return { label: "Manquant", tone: "neutral" };
  if (!certificate.validUntil) return { label: "Sans date de validité", tone: "accent" };
  if (isExpired(certificate.validUntil)) return { label: "Expiré", tone: "danger" };
  return { label: `Valide jusqu'au ${formatCalendarDate(certificate.validUntil)}`, tone: "success" };
}

/* FFK seasons run September to August. */
export function currentSeason(): string {
  const [year, month] = todayInParis().split("-").map(Number);
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}
