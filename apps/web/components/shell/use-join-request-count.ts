"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { usePolling } from "@/lib/use-polling";

const POLL_MS = 60_000;
export const JOIN_REQUESTS_CHANGED_EVENT = "shobukapp:join-requests-changed";

export function notifyJoinRequestsChanged() {
  window.dispatchEvent(new Event(JOIN_REQUESTS_CHANGED_EVENT));
}

/* New join requests for the admin badge. Never called for a practitioner (`enabled` false). */
export function useJoinRequestCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const result = await apiRequest<{ count: number }>("GET", "/admin/join-requests/count");
    if (result.ok) setCount(result.data.count);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // First read on mount, then the polling below takes over.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(JOIN_REQUESTS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(JOIN_REQUESTS_CHANGED_EVENT, onChange);
  }, [enabled, refresh]);

  usePolling(() => void refresh(), POLL_MS, enabled);
  return enabled ? count : 0;
}
