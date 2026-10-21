"use client";

import { useEffect, useRef } from "react";

/*
 * Calls `tick` every `intervalMs` while the tab is visible, and once right away
 * when the tab becomes visible again. The latest `tick` is always used.
 */
export function usePolling(tick: () => void, intervalMs: number, enabled = true) {
  const latest = useRef(tick);
  useEffect(() => {
    latest.current = tick;
  });

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") latest.current();
    }, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled]);
}

/* Lets any screen ask the navigation badge to refresh (after reading or sending). */
export const MESSAGES_CHANGED_EVENT = "shobukapp:messages-changed";

export function notifyMessagesChanged() {
  window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT));
}
