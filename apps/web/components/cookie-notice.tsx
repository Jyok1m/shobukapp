"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const KEY = "shobukapp-cookie-notice";
const EVENT = "shobukapp:cookie-notice";

function dismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    // Storage blocked: show the notice, it can still be closed for this page.
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

let closedThisPage = false;

/*
 * Informational only: the app sets one strictly necessary cookie (the session),
 * so there is nothing to accept or refuse. On small screens it is sticky at the
 * end of the page flow and takes its own space; on large screens a small card at
 * the bottom right, clear of the sidebar and its logout button.
 */
export function CookieNotice() {
  // Hidden on the server: no flash for visitors who already closed it.
  const hidden = useSyncExternalStore(subscribe, () => closedThisPage || dismissed(), () => true);
  if (hidden) return null;

  function close() {
    closedThisPage = true;
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Not stored: it will show again on the next visit.
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <section
      aria-label="Information sur les cookies"
      className="sticky bottom-0 z-40 border-t border-line bg-surface px-4 py-2 shadow-lg sm:py-3 lg:fixed lg:right-4 lg:bottom-4 lg:max-w-md lg:rounded-lg lg:border"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 sm:gap-4 lg:mx-0">
        <p className="flex-1 text-xs text-ink sm:text-sm">
          Ce site utilise uniquement un cookie nécessaire à votre connexion. Aucun cookie de mesure d&apos;audience ni
          de publicité.{" "}
          <Link href="/confidentialite" className="font-medium text-accent underline underline-offset-2">
            En savoir plus
          </Link>
        </p>
        <Button size="sm" variant="secondary" onClick={close} className="shrink-0">
          Compris
        </Button>
      </div>
    </section>
  );
}
