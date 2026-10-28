"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type ToastTone = "success" | "info" | "warning" | "danger";

type Toast = { id: number; tone: ToastTone; title: string; description?: string };
export type ToastInput = Omit<Toast, "id">;
type ToastApi = {
  show: (toast: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS = 6000;
const MAX_VISIBLE = 4;

const tones: Record<ToastTone, string> = {
  success: "border-success/30 bg-success-soft text-success",
  info: "border-line bg-surface text-ink",
  warning: "border-warning/30 bg-warning-soft text-warning",
  danger: "border-danger/30 bg-danger-soft text-danger",
};

/*
 * Short confirmations after an action ("Profil enregistré"). Mounted once in
 * the root layout, so a toast survives a client navigation. Inline errors stay
 * in the forms: a toast is an echo, never the only place a problem is shown.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  const api = useMemo<ToastApi>(() => {
    const show = (toast: ToastInput) => {
      const id = ++nextId.current;
      setToasts((list) => [...list, { ...toast, id }].slice(-MAX_VISIBLE));
    };
    return {
      show,
      success: (title, description) => show({ tone: "success", title, description }),
      error: (title, description) => show({ tone: "danger", title, description }),
      info: (title, description) => show({ tone: "info", title, description }),
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Two live regions: errors interrupt, the rest waits for a pause. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col gap-2 p-4 sm:inset-x-auto sm:top-auto sm:right-0 sm:w-full sm:max-w-md sm:bottom-0 lg:top-0 lg:bottom-auto">
        <div role="alert" className="flex flex-col items-center gap-2 sm:items-end">
          {toasts.filter((t) => t.tone === "danger").map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
        <div role="status" className="flex flex-col items-center gap-2 sm:items-end">
          {toasts.filter((t) => t.tone !== "danger").map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [paused, toast.id, onDismiss]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cx(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-sm motion-safe:animate-toast-in",
        tones[toast.tone],
      )}
    >
      <div className="flex flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description && <p className="text-xs text-ink">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Fermer la notification"
        className="-m-1 flex size-8 shrink-0 items-center justify-center rounded-md opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-accent"
      >
        <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="size-4">
          <path d="m4 4 8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast outside ToastProvider");
  return api;
}
