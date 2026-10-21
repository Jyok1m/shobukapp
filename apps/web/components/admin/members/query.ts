import type { MembershipFilter } from "@/lib/types";

export const membershipFilters: { value: MembershipFilter | null; label: string }[] = [
  { value: null, label: "Tous" },
  { value: "active", label: "À jour" },
  { value: "past_due", label: "En retard" },
  { value: "none", label: "Sans cotisation" },
];

export type MemberQuery = { q: string; status: MembershipFilter | null };

/* Normalises raw search params: an unknown status is ignored rather than sent as a 400. */
export function parseMemberQuery(params: Record<string, string | string[] | undefined>): MemberQuery {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const q = first(params.q).trim().slice(0, 100);
  const raw = first(params.status);
  const status = membershipFilters.some((filter) => filter.value === raw) ? (raw as MembershipFilter) : null;
  return { q, status };
}

export function membersSearch(query: Partial<MemberQuery> & { cursor?: string | null }): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (query.cursor) params.set("cursor", query.cursor);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function fullName(member: { firstName: string; lastName: string }): string {
  return `${member.firstName} ${member.lastName}`;
}
