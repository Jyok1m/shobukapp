import type { BadgeTone } from "@/components/ui/badge";
import type { LicenseRequestMissingField, LicenseRequestStatus } from "./types";

export const licenseRequestStatuses: Record<LicenseRequestStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "À faire", tone: "warning" },
  SENT: { label: "Envoyée à la FFJDA", tone: "accent" },
  DONE: { label: "Licence reçue", tone: "success" },
};

export const missingFieldLabels: Record<LicenseRequestMissingField, string> = {
  birthDate: "date de naissance",
  sex: "sexe",
  nationality: "nationalité",
  address: "adresse",
};

/* "Profil incomplet : date de naissance, adresse", or null when nothing is missing. */
export function missingFieldsText(fields: LicenseRequestMissingField[]): string | null {
  if (fields.length === 0) return null;
  return `Profil incomplet : ${fields.map((field) => missingFieldLabels[field]).join(", ")}`;
}

/* URL value -> API status. No value means "À faire": what an admin opens the page for. */
export const licenseRequestFilters: { value: string | null; label: string; status: LicenseRequestStatus | null }[] = [
  { value: null, label: "À faire", status: "PENDING" },
  { value: "envoyees", label: "Envoyées", status: "SENT" },
  { value: "recues", label: "Reçues", status: "DONE" },
  { value: "toutes", label: "Toutes", status: null },
];

export function parseLicenseRequestFilter(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return licenseRequestFilters.find((filter) => filter.value === (value ?? null)) ?? licenseRequestFilters[0];
}

export function licenseRequestsPath(query: {
  season?: string;
  status?: LicenseRequestStatus | null;
  userId?: string;
  cursor?: string | null;
  limit?: number;
}): string {
  const params = new URLSearchParams();
  if (query.season) params.set("season", query.season);
  if (query.status) params.set("status", query.status);
  if (query.userId) params.set("userId", query.userId);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  const search = params.toString();
  return `/admin/license-requests${search ? `?${search}` : ""}`;
}

export function licenseRequestsExportUrl(season: string): string {
  return `/api/admin/license-requests/export?${new URLSearchParams({ season, status: "PENDING" })}`;
}
