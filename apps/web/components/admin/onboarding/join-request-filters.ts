import type { JoinRequestStatus } from "@/lib/types";

/* URL value -> API status. No value means "Nouvelles": what an admin opens the page for. */
export const joinRequestFilters: { value: string | null; label: string; status: JoinRequestStatus | null }[] = [
  { value: null, label: "Nouvelles", status: "NEW" },
  { value: "invitees", label: "Invitées", status: "INVITED" },
  { value: "refusees", label: "Refusées", status: "DECLINED" },
  { value: "toutes", label: "Toutes", status: null },
];

export function parseJoinRequestFilter(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return joinRequestFilters.find((filter) => filter.value === (value ?? null)) ?? joinRequestFilters[0];
}

export function joinRequestsPath(status: JoinRequestStatus | null, cursor?: string | null): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (cursor) params.set("cursor", cursor);
  const search = params.toString();
  return `/admin/join-requests${search ? `?${search}` : ""}`;
}
