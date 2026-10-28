"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { tourSteps, type TourVariant } from "./steps";

type TourApi = { start: (variant: TourVariant) => void };

const TourContext = createContext<TourApi | null>(null);

const storageKey = (variant: TourVariant, userId: string) => `shobukapp-tour:${variant}:${userId}`;
/* Storage blocked: the tour still shows only once per page load. */
const seenThisLoad = new Set<string>();

function seen(key: string): boolean {
  if (seenThisLoad.has(key)) return true;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markSeen(key: string) {
  seenThisLoad.add(key);
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Not stored: it will open again on the next visit.
  }
}

/* The visible element for a step: the menu link on a wide screen, else the "Menu" button of the phone header. */
function findTarget(target: string | undefined): { element: HTMLElement; viaMenu: boolean } | null {
  if (!target) return null;
  const visible = (el: Element | null): el is HTMLElement => el instanceof HTMLElement && el.getClientRects().length > 0;
  const direct = Array.from(document.querySelectorAll(`[data-tour="${target}"]`)).find(visible);
  if (direct) return { element: direct, viaMenu: false };
  const menu = document.querySelector('[data-tour="menu"]');
  return visible(menu) ? { element: menu, viaMenu: true } : null;
}

/*
 * First-visit guided tour (docs/design.md, Guided tour). Opens by itself once
 * per account and device: the member tour first, the admin tour on the first
 * admin page. "Aide" replays either. The page behind is inert while it runs.
 */
export function TourProvider({
  userId,
  isAdmin,
  children,
}: {
  userId: string;
  isAdmin: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [variant, setVariant] = useState<TourVariant | null>(null);
  const [index, setIndex] = useState(0);

  const start = useCallback((next: TourVariant) => {
    setVariant(next);
    setIndex(0);
  }, []);

  // Deferred a moment: the page settles, and the menu links are in place to be highlighted.
  useEffect(() => {
    if (variant) return;
    const next: TourVariant | null = !seen(storageKey("member", userId))
      ? "member"
      : isAdmin && pathname.startsWith("/admin") && !seen(storageKey("admin", userId))
        ? "admin"
        : null;
    if (!next) return;
    const timer = window.setTimeout(() => start(next), 400);
    return () => window.clearTimeout(timer);
  }, [pathname, userId, isAdmin, variant, start]);

  const close = useCallback(() => {
    if (variant) markSeen(storageKey(variant, userId));
    setVariant(null);
  }, [variant, userId]);

  const api = useMemo(() => ({ start }), [start]);

  return (
    <TourContext.Provider value={api}>
      {children}
      {variant && (
        <TourOverlay
          key={variant}
          variant={variant}
          index={index}
          onIndex={setIndex}
          onClose={close}
          onContinueAdmin={
            variant === "member" && isAdmin
              ? () => {
                  markSeen(storageKey("member", userId));
                  start("admin");
                }
              : undefined
          }
        />
      )}
    </TourContext.Provider>
  );
}

type Rect = { top: number; left: number; width: number; height: number };

function TourOverlay({
  variant,
  index,
  onIndex,
  onClose,
  onContinueAdmin,
}: {
  variant: TourVariant;
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  onContinueAdmin?: () => void;
}) {
  const steps = tourSteps[variant];
  const step = steps[index];
  const last = index === steps.length - 1;
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const [rect, setRect] = useState<Rect | null>(null);
  const [viaMenu, setViaMenu] = useState(false);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useLayoutEffect(() => {
    function measure() {
      setWide(window.matchMedia("(min-width: 64rem)").matches);
      const found = findTarget(step.target);
      setViaMenu(Boolean(found?.viaMenu));
      if (!found) return setRect(null);
      const box = found.element.getBoundingClientRect();
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
    }
    findTarget(step.target)?.element.scrollIntoView({ block: "nearest" });
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step.target]);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("[data-tour-next]")?.focus();
  }, [index]);

  const pad = 6;
  const spotlight: CSSProperties | undefined = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        boxShadow: "0 0 0 100vmax var(--color-scrim)",
      }
    : undefined;
  /* Beside the sidebar link on a wide screen; on a phone the card sits at the bottom, clear of the header. */
  const beside: CSSProperties | undefined =
    rect && wide && !viaMenu
      ? { left: rect.left + rect.width + 24, top: Math.max(16, Math.min(rect.top - 24, window.innerHeight - 380)) }
      : undefined;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-transparent"
    >
      {spotlight ? (
        <div
          aria-hidden
          style={spotlight}
          className="pointer-events-none fixed rounded-lg outline-4 outline-accent transition-all motion-reduce:transition-none"
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-scrim" />
      )}

      <div
        style={beside}
        className={cx(
          "fixed flex max-h-11/12 flex-col gap-5 overflow-y-auto rounded-xl border border-line bg-surface p-5 text-ink shadow-sm sm:p-6",
          beside
            ? "w-full max-w-md"
            : rect
              ? "inset-x-4 bottom-4 mx-auto max-w-lg"
              : "inset-x-4 top-1/2 mx-auto max-w-lg -translate-y-1/2",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted">
            Étape {index + 1} sur {steps.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md px-2 text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-accent"
          >
            Arrêter la visite
          </button>
        </div>

        <div aria-hidden className="flex gap-1.5">
          {steps.map((_, i) => (
            <span key={i} className={cx("h-1.5 flex-1 rounded-full", i <= index ? "bg-accent" : "bg-line")} />
          ))}
        </div>

        <div className="flex flex-col gap-3" aria-live="polite">
          <h2 id={titleId} className="font-serif text-xl font-bold sm:text-2xl">
            {step.title}
          </h2>
          <p id={bodyId} className="text-base leading-relaxed sm:text-lg">
            {step.body}
          </p>
          {viaMenu && (
            <p className="rounded-md border border-line bg-accent-soft px-3 py-2 text-base text-ink">
              Sur téléphone, cette rubrique se trouve dans le menu : touchez le bouton « Menu », en haut à droite, éclairé
              ici.
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button
            variant="secondary"
            onClick={() => onIndex(index - 1)}
            disabled={index === 0}
            className="min-h-12 text-base"
          >
            Retour
          </Button>
          {last && onContinueAdmin ? (
            <Button data-tour-next onClick={onContinueAdmin} className="min-h-12 text-base">
              Continuer avec l&apos;administration
            </Button>
          ) : (
            <Button data-tour-next onClick={() => (last ? onClose() : onIndex(index + 1))} className="min-h-12 text-base">
              {last ? "Terminer la visite" : "Suivant"}
            </Button>
          )}
        </div>
        {last && onContinueAdmin && (
          <button
            type="button"
            onClick={onClose}
            className="-mt-2 self-center text-sm font-medium text-accent underline underline-offset-2"
          >
            Terminer ici
          </button>
        )}
      </div>
    </dialog>
  );
}

export function useTour(): TourApi {
  const api = useContext(TourContext);
  if (!api) throw new Error("useTour outside TourProvider");
  return api;
}
