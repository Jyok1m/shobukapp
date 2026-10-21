"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { MESSAGES_CHANGED_EVENT, usePolling } from "@/lib/use-polling";

const UNREAD_POLL_MS = 60_000;

/* Unread messages for the navigation badge: polled, and refreshed when a thread is read. */
export function useUnreadCount(): number {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    const result = await apiRequest<{ unread: number }>("GET", "/messages/unread-count");
    if (result.ok) setUnread(result.data.unread);
  }, []);

  useEffect(() => {
    // First read on mount, then the polling below takes over.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(MESSAGES_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(MESSAGES_CHANGED_EVENT, onChange);
  }, [refresh]);

  usePolling(() => void refresh(), UNREAD_POLL_MS);
  return unread;
}
