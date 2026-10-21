"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/client-api";
import type { AdminMemberListItem, AdminMembersPage } from "@/lib/types";
import { membersSearch, type MemberQuery } from "./query";

/* "Charger plus" over GET /admin/members with the same filters as the first page. */
export function useMemberPages(initial: AdminMembersPage, query: MemberQuery) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor) return;
    setPending(true);
    setError(null);
    const result = await apiRequest<AdminMembersPage>("GET", `/admin/members${membersSearch({ ...query, cursor })}`);
    setPending(false);
    if (!result.ok) return setError(result.error);
    setItems((current) => [...current, ...result.data.items]);
    setCursor(result.data.nextCursor);
  }

  function update(id: string, patch: Partial<AdminMemberListItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return { items, hasMore: cursor !== null, pending, error, loadMore, update };
}
